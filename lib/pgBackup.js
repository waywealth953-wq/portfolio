/* WAYWEALTH — Postgres auto-backup (Aiven / Render / Neon)
   Backs up ALL sqlite data + ALL files in public/uploads to Postgres.
   Restores them automatically on boot (fixes Render ephemeral disk).

   Env:
     DATABASE_URL            - postgres connection string (?sslmode=require supported)
     BACKUP_INTERVAL_MIN     - default 10 (0 to disable cron)
     BACKUP_ON_WRITE         - default 1 (backup ~30s after any admin write)
     BACKUP_FILES_MAX_MB     - default 40 total cap for file backups
*/
const fs = require('fs');
const path = require('path');

let Pool = null;
try { ({ Pool } = require('pg')); } catch { /* pg not installed */ }

let pool = null;
let backupTimer = null;
let backingUp = false;

function isEnabled() {
  return !!(process.env.DATABASE_URL && Pool);
}

function getPool() {
  if (!isEnabled()) return null;
  if (!pool) {
    // Strip sslmode from URL — we force ssl:{rejectUnauthorized:false} below
    // because Aiven uses a self-signed chain that pg v8+ rejects otherwise.
    let conn = process.env.DATABASE_URL;
    try {
      const u = new URL(conn);
      u.searchParams.delete('sslmode');
      u.searchParams.delete('ssl');
      conn = u.toString();
    } catch {}
    pool = new Pool({
      connectionString: conn,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 60000,
    });
    pool.on('error', (e) => console.error('[Backup] pg pool error:', e.message));
  }
  return pool;
}

// All sqlite tables we mirror into Postgres as JSON rows.
// Generic envelope avoids schema drift between sqlite <-> pg.
const TABLE_NAMES = [
  'content', 'media', 'team', 'certificates', 'process_steps',
  'pricing_plans', 'faqs', 'sections', 'leads', 'events',
  'admin_users', 'stats_cache', 'login_attempts',
];

async function ensureSchema() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS ww_table_backup (
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (table_name, row_id)
    );
    CREATE TABLE IF NOT EXISTS ww_file_backup (
      file_path TEXT PRIMARY KEY,
      data_base64 TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ww_file_chunks (
      file_path TEXT NOT NULL,
      chunk_idx INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      PRIMARY KEY (file_path, chunk_idx)
    );
    CREATE TABLE IF NOT EXISTS ww_backup_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

function rowId(table, row, idx) {
  if (row.id !== undefined && row.id !== null) return `${table}:${row.id}`;
  if (row.key !== undefined && row.key !== null) return `${table}:${row.key}`;
  if (row.metric !== undefined && row.metric !== null) return `${table}:${row.metric}`;
  return `${table}:r${idx}`;
}

/** Push entire sqlite DB + uploads folder to Postgres. Returns {tables, files}. */
async function backupNow(sqliteDb, uploadsDir) {
  const p = getPool();
  if (!p) return { skipped: 'DATABASE_URL not set or pg not installed' };
  if (backingUp) return { skipped: 'already running' };
  backingUp = true;
  try {
    await ensureSchema();
    const client = await p.connect();
    try {
      await client.query('BEGIN');
      let tableCount = 0;
      const seen = new Set();
      for (const t of TABLE_NAMES) {
        let rows = [];
        try { rows = sqliteDb.prepare(`SELECT * FROM "${t}"`).all(); }
        catch (e) { console.warn(`[Backup] skip table ${t}:`, e.message); continue; }
        // wipe + rewrite this table's snapshot (simple + idempotent)
        await client.query('DELETE FROM ww_table_backup WHERE table_name = $1', [t]);
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          // JSON can't hold Buffer/undefined — stringify-safe clean
          const clean = JSON.parse(JSON.stringify(r, (k, v) => (v === undefined ? null : v)));
          await client.query(
            'INSERT INTO ww_table_backup (table_name, row_id, data) VALUES ($1,$2,$3)',
            [t, rowId(t, r, i), clean]
          );
        }
        tableCount += rows.length;
        seen.add(t);
      }
      // ── Files: public/uploads/* (incremental — skip unchanged by size,
      //        each file committed separately so big videos can't time out the whole backup) ──
      await client.query('COMMIT'); // tables done — commit before slow file uploads
      let fileCount = 0;
      let fileBytes = 0;
      let skippedUnchanged = 0;
      const maxBytes = (parseFloat(process.env.BACKUP_FILES_MAX_MB) || 120) * 1024 * 1024;
      const existing = await client.query('SELECT file_path, size_bytes FROM ww_file_backup');
      const existingMap = new Map(existing.rows.map((r) => [r.file_path, r.size_bytes]));
      const chunkCounts = await client.query('SELECT file_path, COUNT(*)::int AS c FROM ww_file_chunks GROUP BY file_path');
      const chunkMap = new Map(chunkCounts.rows.map((r) => [r.file_path, r.c]));
      const CHUNK_RAW = 3 * 1024 * 1024; // 3 MB raw → ~4 MB base64 per chunk
      const BIG = 6 * 1024 * 1024;
      const seenFiles = new Set();
      if (uploadsDir && fs.existsSync(uploadsDir)) {
        const names = fs.readdirSync(uploadsDir).filter((n) => n !== '.gitkeep');
        for (const n of names) {
          const fp = path.join(uploadsDir, n);
          try {
            const st = fs.statSync(fp);
            if (!st.isFile()) continue;
            seenFiles.add(n);
            fileBytes += st.size;
            const isBig = st.size > BIG;
            const expectedChunks = isBig ? Math.ceil(st.size / CHUNK_RAW) : 0;
            const complete = isBig
              ? (existingMap.get(n) === st.size && chunkMap.get(n) === expectedChunks)
              : (existingMap.get(n) === st.size);
            if (complete) { skippedUnchanged++; continue; } // already backed up
            if (st.size > maxBytes) {
              console.warn(`[Backup] file too large, skipping ${n} (${Math.round(st.size / 1024 / 1024)} MB)`);
              continue;
            }
            // Small files: single-row upsert. Big files: chunked upload
            // (manifest written LAST so an interrupted run resumes instead of corrupting).
            if (!isBig) {
              const b64 = fs.readFileSync(fp).toString('base64');
              console.log(`[Backup] uploading ${n} (${Math.round(st.size / 1024)} KB)…`);
              await client.query(
                'INSERT INTO ww_file_backup (file_path, data_base64, size_bytes) VALUES ($1,$2,$3) ON CONFLICT (file_path) DO UPDATE SET data_base64 = EXCLUDED.data_base64, size_bytes = EXCLUDED.size_bytes, updated_at = now()',
                [n, b64, st.size]
              );
              await client.query('DELETE FROM ww_file_chunks WHERE file_path = $1', [n]);
            } else {
              console.log(`[Backup] uploading ${n} (${Math.round(st.size / 1024 / 1024)} MB, chunked)…`);
              const buf = fs.readFileSync(fp);
              const totalChunks = Math.ceil(buf.length / CHUNK_RAW);
              await client.query('DELETE FROM ww_file_chunks WHERE file_path = $1', [n]);
              await client.query('DELETE FROM ww_file_backup WHERE file_path = $1', [n]);
              for (let ci = 0; ci < totalChunks; ci++) {
                const slice = buf.subarray(ci * CHUNK_RAW, (ci + 1) * CHUNK_RAW);
                await client.query(
                  'INSERT INTO ww_file_chunks (file_path, chunk_idx, data_base64) VALUES ($1,$2,$3)',
                  [n, ci, slice.toString('base64')]
                );
                if ((ci + 1) % 5 === 0 || ci === totalChunks - 1) console.log(`[Backup]   ${n}: chunk ${ci + 1}/${totalChunks}`);
              }
              await client.query(
                "INSERT INTO ww_file_backup (file_path, data_base64, size_bytes) VALUES ($1, '', $2)",
                [n, st.size]
              );
            }
            fileCount++;
          } catch (e) { console.warn(`[Backup] skip file ${n}:`, e.message); }
        }
      }
      // Remove backups of files deleted locally
      for (const old of existingMap.keys()) {
        if (!seenFiles.has(old)) {
          await client.query('DELETE FROM ww_file_backup WHERE file_path = $1', [old]);
          await client.query('DELETE FROM ww_file_chunks WHERE file_path = $1', [old]);
        }
      }
      console.log(`[Backup] files: ${fileCount} uploaded, ${skippedUnchanged} unchanged, total ${Math.round(fileBytes / 1024)} KB`);
      await client.query(
        "INSERT INTO ww_backup_meta (key, value, updated_at) VALUES ('last_backup_at', $1, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
        [new Date().toISOString()]
      );
      console.log(`[Backup] OK — ${tableCount} rows, ${fileCount} files (${Math.round(fileBytes / 1024)} KB) → Postgres`);
      return { tables: tableCount, files: fileCount };
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  } finally {
    backingUp = false;
  }
}

/** Pull Postgres snapshot back into sqlite + uploads. Runs on boot when sqlite is empty. */
async function restoreIfEmpty(sqliteDb, uploadsDir) {
  const p = getPool();
  if (!p) return { skipped: 'no DATABASE_URL' };
  // If sqlite already has real data, don't overwrite (Render fresh boot = empty).
  let localLeads = 0, localContent = 0;
  try {
    localLeads = sqliteDb.prepare('SELECT COUNT(*) as c FROM leads').get().c;
    localContent = sqliteDb.prepare('SELECT COUNT(*) as c FROM content').get().c;
  } catch {}
  // Fresh Render disk: seeded content exists but leads/media/uploads are empty.
  // Only restore when the DB looks fresh (no leads AND uploads folder empty).
  let uploadFiles = [];
  try {
    if (fs.existsSync(uploadsDir)) uploadFiles = fs.readdirSync(uploadsDir).filter((n) => n !== '.gitkeep');
  } catch {}
  if (localLeads > 0 || uploadFiles.length > 2) {
    return { skipped: `local data present (leads=${localLeads}, files=${uploadFiles.length})` };
  }
  await ensureSchema();
  const { rows } = await p.query('SELECT table_name, data FROM ww_table_backup ORDER BY table_name');
  if (!rows.length) return { skipped: 'no backup found in Postgres yet' };

  const byTable = {};
  for (const r of rows) (byTable[r.table_name] = byTable[r.table_name] || []).push(r.data);

  // Clear seed rows then re-insert backup rows (so IDs/descriptions match exactly).
  for (const t of Object.keys(byTable)) {
    const dataRows = byTable[t];
    if (!dataRows.length) continue;
    try {
      sqliteDb.exec(`DELETE FROM "${t}"`);
      const cols = Object.keys(dataRows[0]);
      const placeholders = cols.map(() => '?').join(',');
      const quoted = cols.map((c) => `"${c}"`).join(',');
      const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO "${t}" (${quoted}) VALUES (${placeholders})`);
      for (const r of dataRows) stmt.run(...cols.map((c) => (typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c])));
      console.log(`[Restore] ${t}: ${dataRows.length} rows`);
    } catch (e) { console.warn(`[Restore] skip ${t}:`, e.message); }
  }
  // Files (single-row + chunked big files)
  let restoredFiles = 0;
  try {
    const fres = await p.query('SELECT file_path, data_base64, size_bytes FROM ww_file_backup');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    for (const f of fres.rows) {
      const safe = path.basename(f.file_path); // prevent path traversal
      let buf;
      if (f.data_base64) {
        buf = Buffer.from(f.data_base64, 'base64');
      } else {
        const cres = await p.query('SELECT data_base64 FROM ww_file_chunks WHERE file_path = $1 ORDER BY chunk_idx', [f.file_path]);
        if (!cres.rows.length) { console.warn(`[Restore] no data for ${safe}, skipped`); continue; }
        buf = Buffer.concat(cres.rows.map((c) => Buffer.from(c.data_base64, 'base64')));
      }
      if (f.size_bytes && buf.length !== f.size_bytes) { console.warn(`[Restore] incomplete ${safe} (${buf.length}/${f.size_bytes} bytes), skipped`); continue; }
      fs.writeFileSync(path.join(uploadsDir, safe), buf);
      restoredFiles++;
    }
    if (restoredFiles) console.log(`[Restore] ${restoredFiles} upload files restored`);
  } catch (e) { console.warn('[Restore] files skipped:', e.message); }

  return { tables: rows.length, files: restoredFiles };
}

async function getStatus() {
  const p = getPool();
  if (!p) return { enabled: false, reason: 'DATABASE_URL missing or pg not installed' };
  try {
    await ensureSchema();
    const meta = await p.query('SELECT key, value, updated_at FROM ww_backup_meta');
    const tc = await p.query('SELECT COUNT(*)::int as c FROM ww_table_backup');
    const fc = await p.query('SELECT COUNT(*)::int as c, COALESCE(SUM(size_bytes),0)::int as b FROM ww_file_backup');
    return {
      enabled: true,
      last_backup_at: meta.rows.find((r) => r.key === 'last_backup_at')?.value || null,
      backed_up_rows: tc.rows[0].c,
      backed_up_files: fc.rows[0].c,
      backed_up_bytes: fc.rows[0].b,
    };
  } catch (e) {
    return { enabled: true, error: e.message };
  }
}

/** Debounced auto-backup after admin writes (30s). */
function scheduleBackup(sqliteDb, uploadsDir, delayMs = 30000) {
  if (!isEnabled() || process.env.BACKUP_ON_WRITE === '0') return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupNow(sqliteDb, uploadsDir).catch((e) => console.error('[Backup] auto failed:', e.message));
  }, delayMs);
  if (backupTimer.unref) backupTimer.unref();
}

module.exports = { isEnabled, getPool, ensureSchema, backupNow, restoreIfEmpty, getStatus, scheduleBackup };
