/* Verify chunked backup: reassemble founder-review-2.mp4 from Postgres, compare sha256. */
const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete('sslmode');
  const p = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  const m = await p.query("SELECT size_bytes FROM ww_file_backup WHERE file_path = 'founder-review-2.mp4'");
  const c = await p.query('SELECT data_base64 FROM ww_file_chunks WHERE file_path = $1 ORDER BY chunk_idx', ['founder-review-2.mp4']);
  const buf = Buffer.concat(c.rows.map((r) => Buffer.from(r.data_base64, 'base64')));
  const local = fs.readFileSync('public/uploads/founder-review-2.mp4');
  console.log('chunks:', c.rows.length, '| db bytes:', buf.length, '| expected:', m.rows[0].size_bytes, '| local:', local.length);
  console.log('sha match:', crypto.createHash('sha256').update(buf).digest('hex') === crypto.createHash('sha256').update(local).digest('hex'));
  await p.end();
  process.exit(0);
})().catch((e) => { console.error('VERIFY FAILED:', e.message); process.exit(1); });
