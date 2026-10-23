import { getDb, normalizeAccountName } from './db';
import { parseWorkbook } from './importer';
import { saveImport } from './repository';

const CATEGORIES = ['IB', 'NN', 'Non-CRM', 'Active'];
const STATUSES = ['Prospect', 'Interested', 'Meeting Scheduled', 'Proposal', 'Closed Won', 'Not Interested'];
const route = (url: string) => new URL(url, window.location.origin);

async function get<T>(url: string): Promise<T> {
  const db = await getDb();
  const request = route(url);
  if (request.pathname === '/api/accounts') {
    const search = request.searchParams.get('search')?.trim() || '';
    const filters = {
      category: request.searchParams.get('category')?.split(',').filter(Boolean) || [],
      status: request.searchParams.get('status')?.split(',').filter(Boolean) || [],
      partner: request.searchParams.get('partner')?.split(',').filter(Boolean) || [],
      industry: request.searchParams.get('industry')?.split(',').filter(Boolean) || [],
    };
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(a.name ILIKE $${params.length} OR a.notes ILIKE $${params.length} OR a.crm_id ILIKE $${params.length})`);
    }
    for (const [column, values] of Object.entries(filters)) {
      if (values.length) { params.push(values); conditions.push(`a.${column} = ANY($${params.length}::text[])`); }
    }
    if (request.searchParams.get('hasContacts') === 'true') conditions.push('EXISTS (SELECT 1 FROM contacts contact_filter WHERE contact_filter.account_id = a.id)');
    if (request.searchParams.get('hasContacts') === 'false') conditions.push('NOT EXISTS (SELECT 1 FROM contacts contact_filter WHERE contact_filter.account_id = a.id)');
    const result = await db.query(`SELECT a.*, COUNT(c.id)::int AS contact_count
      FROM accounts a LEFT JOIN contacts c ON c.account_id = a.id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY a.id ORDER BY a.updated_at DESC, a.name ASC`, params);
    return result.rows as T;
  }
  const detailMatch = request.pathname.match(/^\/api\/accounts\/(\d+)$/);
  if (detailMatch) {
    const account = await db.query('SELECT * FROM accounts WHERE id = $1', [detailMatch[1]]);
    if (!account.rows[0]) throw new Error('Account not found');
    const [contacts, activities] = await Promise.all([
      db.query('SELECT * FROM contacts WHERE account_id = $1 ORDER BY first_name, last_name', [detailMatch[1]]),
      db.query('SELECT * FROM activity_log WHERE account_id = $1 ORDER BY created_at DESC', [detailMatch[1]]),
    ]);
    return { ...account.rows[0], contacts: contacts.rows, activities: activities.rows } as T;
  }
  if (request.pathname === '/api/filters') {
    const [partners, industries] = await Promise.all([
      db.query<{ value: string }>("SELECT DISTINCT partner AS value FROM accounts WHERE partner <> '' ORDER BY partner"),
      db.query<{ value: string }>("SELECT DISTINCT industry AS value FROM accounts WHERE industry <> '' ORDER BY industry"),
    ]);
    return { categories: CATEGORIES, statuses: STATUSES, partners: partners.rows.map((row) => row.value), industries: industries.rows.map((row) => row.value) } as T;
  }
  if (request.pathname === '/api/dashboard') {
    const [total, categories, statuses, contacts, territorySegments, recent] = await Promise.all([
      db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM accounts'),
      db.query('SELECT category AS label, COUNT(*)::int AS count FROM accounts GROUP BY category ORDER BY count DESC'),
      db.query('SELECT status AS label, COUNT(*)::int AS count FROM accounts GROUP BY status ORDER BY count DESC'),
      db.query<{ count: number }>('SELECT COUNT(DISTINCT account_id)::int AS count FROM contacts'),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE category = 'Active')::int AS active_ib,
        COUNT(*) FILTER (WHERE category = 'IB')::int AS dormant_ib,
        COUNT(*) FILTER (WHERE category = 'NN')::int AS crm_nnn,
        COUNT(*) FILTER (WHERE category = 'Non-CRM' AND EXISTS (SELECT 1 FROM contacts WHERE contacts.account_id = accounts.id))::int AS profiled_non_crm,
        COUNT(*) FILTER (WHERE category = 'Non-CRM' AND NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.account_id = accounts.id))::int AS new_non_crm
        FROM accounts`),
      db.query('SELECT id, name, category, status, updated_at FROM accounts ORDER BY updated_at DESC LIMIT 6'),
    ]);
    return { total: total.rows[0].count, byCategory: categories.rows, byStatus: statuses.rows, withContacts: contacts.rows[0].count, territorySegments: territorySegments.rows[0], recent: recent.rows } as T;
  }
  if (request.pathname === '/api/import-runs') return (await db.query('SELECT * FROM import_runs ORDER BY imported_at DESC LIMIT 50')).rows as T;
  throw new Error(`Unknown request: ${request.pathname}`);
}

async function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const db = await getDb();
  const request = route(url);
  if (request.pathname === '/api/accounts/bulk-status') {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (!ids.length || !STATUSES.includes(String(body.status))) throw new Error('Select accounts and a valid status');
    const result = await db.query('UPDATE accounts SET status = $1, updated_at = NOW() WHERE id = ANY($2::bigint[]) RETURNING id', [body.status, ids]);
    return { updated: result.rows.length } as T;
  }
  const contactMatch = request.pathname.match(/^\/api\/accounts\/(\d+)\/contacts$/);
  if (contactMatch) {
    const value = body as Record<string, string>;
    const result = await db.query(`INSERT INTO contacts (account_id, first_name, last_name, title, email, phone, linkedin)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [contactMatch[1], value.first_name || '', value.last_name || '', value.title || '', value.email || '', value.phone || '', value.linkedin || '']);
    return result.rows[0] as T;
  }
  const activityMatch = request.pathname.match(/^\/api\/accounts\/(\d+)\/activities$/);
  if (activityMatch) {
    const note = String(body.body || '').trim();
    if (!note) throw new Error('Activity note cannot be empty');
    const result = await db.query('INSERT INTO activity_log (account_id, body, activity_type) VALUES ($1,$2,$3) RETURNING *', [activityMatch[1], note, body.activity_type || 'note']);
    return result.rows[0] as T;
  }
  throw new Error(`Unknown request: ${request.pathname}`);
}

async function patch<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const db = await getDb();
  const request = route(url);
  const accountMatch = request.pathname.match(/^\/api\/accounts\/(\d+)$/);
  if (accountMatch) {
    const allowed = ['name', 'category', 'status', 'industry', 'partner', 'crm_id', 'notes'];
    const entries = Object.entries(body).filter(([field]) => allowed.includes(field));
    if (!entries.length) throw new Error('No editable fields supplied');
    const sets = entries.map(([field], index) => `${field} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    if (body.name) { sets.push(`name_normalized = $${values.length + 1}`); values.push(normalizeAccountName(String(body.name))); }
    values.push(accountMatch[1]);
    const result = await db.query(`UPDATE accounts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    return result.rows[0] as T;
  }
  const contactMatch = request.pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (contactMatch) {
    const allowed = ['first_name', 'last_name', 'title', 'email', 'phone', 'linkedin'];
    const entries = Object.entries(body).filter(([field]) => allowed.includes(field));
    const values = entries.map(([, value]) => value);
    values.push(contactMatch[1]);
    const result = await db.query(`UPDATE contacts SET ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    return result.rows[0] as T;
  }
  throw new Error(`Unknown request: ${request.pathname}`);
}

async function remove<T>(url: string): Promise<T> {
  const db = await getDb();
  const match = route(url).pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (!match) throw new Error('Unknown delete request');
  await db.query('DELETE FROM contacts WHERE id = $1', [match[1]]);
  return undefined as T;
}

async function importFiles(files: File[]) {
  const runs = [];
  for (const file of files) {
    try { runs.push(await saveImport(await parseWorkbook(file), file.name)); }
    catch (error) { runs.push({ filename: file.name, error: error instanceof Error ? error.message : 'Import failed' }); }
  }
  return { runs };
}

export const api = { get, post, patch, delete: remove, importFiles };
