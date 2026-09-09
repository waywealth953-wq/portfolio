/* Manual backup: node scripts/backup-now.js (uses DATABASE_URL from .env) */
require('dotenv').config();
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const pgBackup = require('../lib/pgBackup');

(async () => {
  const db = new DatabaseSync(path.join(__dirname, '..', 'data.db'));
  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
  console.log('Backing up to:', (process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':****@'));
  const r = await pgBackup.backupNow(db, uploadsDir);
  console.log('Result:', r);
  process.exit(0);
})().catch((e) => { console.error('BACKUP FAILED:', e.message); process.exit(1); });
