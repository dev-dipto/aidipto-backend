import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { env } from './env.js';

const dir = path.dirname(env.databasePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(env.databasePath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    website TEXT,
    business_type TEXT,
    service TEXT,
    requirement TEXT,
    budget TEXT,
    timeline TEXT,
    source TEXT NOT NULL DEFAULT 'website',
    conversation_summary TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    session_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_logs(session_id);

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

/**
 * The admin account is defined by ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * On every boot we sync the stored hash to whatever is currently in .env,
 * so changing the password just means editing .env and restarting.
 */
function syncAdminUser() {
  const hash = bcrypt.hashSync(env.adminPassword, 10);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO admin_users (email, password_hash, updated_at)
     VALUES (@email, @hash, @now)
     ON CONFLICT(email) DO UPDATE SET password_hash = @hash, updated_at = @now`,
  ).run({ email: env.adminEmail, hash, now });
}
syncAdminUser();
