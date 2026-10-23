import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
const dataRoot = path.resolve(process.env.DATA_DIR || 'data');
await mkdir(dataRoot, { recursive: true });
export const db = new PGlite(`file://${path.join(dataRoot, 'pglite')}`);
export async function initDb() {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'NN',
      status TEXT NOT NULL DEFAULT 'Prospect',
      industry TEXT NOT NULL DEFAULT '',
      partner TEXT NOT NULL DEFAULT '',
      crm_id TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS accounts_crm_id_unique ON accounts(crm_id) WHERE crm_id IS NOT NULL AND crm_id <> '';
    CREATE INDEX IF NOT EXISTS accounts_category_idx ON accounts(category);
    CREATE INDEX IF NOT EXISTS accounts_status_idx ON accounts(status);

    CREATE TABLE IF NOT EXISTS contacts (
      id BIGSERIAL PRIMARY KEY,
      account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      linkedin TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS contacts_account_idx ON contacts(account_id);
    CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(LOWER(email));

    CREATE TABLE IF NOT EXISTS activity_log (
      id BIGSERIAL PRIMARY KEY,
      account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'note',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS activity_account_idx ON activity_log(account_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS import_runs (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'unknown',
      accounts_created INTEGER NOT NULL DEFAULT 0,
      accounts_updated INTEGER NOT NULL DEFAULT 0,
      contacts_created INTEGER NOT NULL DEFAULT 0,
      warnings TEXT NOT NULL DEFAULT '',
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
export function normalizeAccountName(value) {
    return value
        .normalize('NFKD')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\b(s\.?a\.?e\.?|llc|ltd|limited|company|co\.?|corp\.?|corporation|egypt)\b/g, ' ')
        .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}
