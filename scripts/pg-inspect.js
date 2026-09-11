const { Pool } = require('pg');
(async () => {
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete('sslmode');
  const p = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  const t = await p.query('SELECT COUNT(*)::int c FROM ww_table_backup');
  const f = await p.query('SELECT file_path, size_bytes FROM ww_file_backup ORDER BY file_path');
  console.log('rows:', t.rows[0].c, '| files:', f.rows.length);
  f.rows.forEach(r => console.log(' ', r.file_path, Math.round(r.size_bytes / 1024) + 'KB'));
  const pf = await p.query("SELECT data->>'caption' c FROM ww_table_backup WHERE table_name='media' AND data->>'type'='portfolio' ORDER BY (data->>'order')::int LIMIT 8");
  console.log('--- portfolio captions in Postgres:');
  pf.rows.forEach(r => console.log(' ', (r.c || '').slice(0, 80)));
  const tm = await p.query("SELECT data->>'name' n, data->>'role' r FROM ww_table_backup WHERE table_name='team' ORDER BY (data->>'order')::int");
  console.log('--- team in Postgres:');
  tm.rows.forEach(r => console.log(' ', r.n, '|', r.r));
  await p.end(); process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
