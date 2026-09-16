/* WAYWEALTH — auto-push watcher.
   Watches the repo for ANY edit and auto commits + pushes (debounced).
   - Respects .gitignore (data.db, .env, uploads, node_modules never pushed)
   - Debounces 45s so rapid saves collapse into one commit
   - Single instance via lockfile; loop-safe (no-op when tree is clean)
   Run: node scripts/auto-push.js   (or: npm run autopush)
*/
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCK = path.join(ROOT, '.git', 'autopush.lock');
const DEBOUNCE_MS = 45000;
const SKIP_DIRS = ['.git', 'node_modules'];

function git(args, timeout = 120000) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: ROOT, timeout }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, out: (stdout || '').trim(), errText: (stderr || '').trim() });
    });
  });
}

function ignorable(p) {
  const rel = path.relative(ROOT, p);
  if (!rel || rel.startsWith('..')) return true;
  return SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep));
}

let timer = null;
let busy = false;

async function syncOnce() {
  if (busy) return;
  busy = true;
  try {
    await git(['add', '-A']);
    const st = await git(['status', '--porcelain']);
    if (st.code !== 0) { console.error('[autopush] status failed:', st.errText); return; }
    if (!st.out) return; // clean — nothing to do (also ends self-trigger loops)
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const c = await git(['commit', '-m', `chore: auto-push ${ts} UTC`]);
    if (c.code !== 0) { console.error('[autopush] commit failed:', c.errText); return; }
    console.log('[autopush] committed:', c.out.split('\n')[0]);
    const p = await git(['push', 'origin', 'main']);
    if (p.code !== 0) console.error('[autopush] push FAILED:', p.errText);
    else console.log('[autopush] pushed OK');
  } finally {
    busy = false;
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncOnce(); }, DEBOUNCE_MS);
}

function acquireLock() {
  try {
    if (fs.existsSync(LOCK)) {
      const pid = parseInt(fs.readFileSync(LOCK, 'utf8'), 10);
      if (pid) {
        try { process.kill(pid, 0); console.log(`[autopush] already running (pid ${pid}) — exiting`); process.exit(0); }
        catch { /* stale lock, take over */ }
      }
    }
    fs.writeFileSync(LOCK, String(process.pid));
  } catch (e) { console.error('[autopush] lock failed:', e.message); process.exit(1); }
}

process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch {} });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

(async () => {
  acquireLock();
  const br = await git(['branch', '--show-current']);
  if (br.out !== 'main') console.log('[autopush] note: on branch', br.out || '?', '(pushes to origin/main)');
  try {
    fs.watch(ROOT, { recursive: true }, (event, filename) => {
      const full = filename ? path.join(ROOT, filename) : ROOT;
      if (ignorable(full)) return;
      schedule();
    });
    console.log(`[autopush] watching ${ROOT} (debounce ${DEBOUNCE_MS / 1000}s) — pid ${process.pid}`);
  } catch (e) {
    console.error('[autopush] watch failed (recursive watch needs Win/macOS):', e.message);
    process.exit(1);
  }
  await syncOnce(); // push anything pending at startup
})();
