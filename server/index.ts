import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, initDb, normalizeAccountName } from './db.js';
import { parseWorkbook } from './importer.js';
import { saveImport } from './repository.js';
import { CATEGORIES, STATUSES } from './types.js';

await initDb();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 20 } });
const shareUsername = process.env.CRM_USERNAME?.trim() || '';
const sharePassword = process.env.CRM_PASSWORD || '';

if (Boolean(shareUsername) !== Boolean(sharePassword)) {
  throw new Error('CRM_USERNAME and CRM_PASSWORD must be set together');
}

const secureEqual = (left: string, right: string) => {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
};

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use((req, res, next) => {
  if (!shareUsername || !sharePassword) return next();
  const authorization = req.headers.authorization || '';
  if (authorization.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const username = separator >= 0 ? decoded.slice(0, separator) : '';
      const password = separator >= 0 ? decoded.slice(separator + 1) : '';
      if (secureEqual(username, shareUsername) && secureEqual(password, sharePassword)) return next();
    } catch {
      // Invalid credentials fall through to the authentication challenge.
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Territory Desk", charset="UTF-8"');
  res.status(401).send('Authentication required');
});
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/accounts', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const categories = String(req.query.category || '').split(',').filter(Boolean);
  const statuses = String(req.query.status || '').split(',').filter(Boolean);
  const partners = String(req.query.partner || '').split(',').filter(Boolean);
  const industries = String(req.query.industry || '').split(',').filter(Boolean);
  const hasContacts = String(req.query.hasContacts || '');
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.notes ILIKE $${params.length} OR a.crm_id ILIKE $${params.length})`);
  }
  for (const [column, values] of [['category', categories], ['status', statuses], ['partner', partners], ['industry', industries]] as const) {
    if (values.length) {
      params.push(values);
      conditions.push(`a.${column} = ANY($${params.length}::text[])`);
    }
  }
  if (hasContacts === 'true') conditions.push('EXISTS (SELECT 1 FROM contacts contact_filter WHERE contact_filter.account_id = a.id)');
  if (hasContacts === 'false') conditions.push('NOT EXISTS (SELECT 1 FROM contacts contact_filter WHERE contact_filter.account_id = a.id)');
  const result = await db.query(`
    SELECT a.*, COUNT(c.id)::int AS contact_count
    FROM accounts a LEFT JOIN contacts c ON c.account_id = a.id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY a.id ORDER BY a.updated_at DESC, a.name ASC`, params);
  res.json(result.rows);
});

app.get('/api/accounts/:id', async (req, res) => {
  const account = await db.query('SELECT * FROM accounts WHERE id = $1', [req.params.id]);
  if (!account.rows[0]) return res.status(404).json({ error: 'Account not found' });
  const [contacts, activities] = await Promise.all([
    db.query('SELECT * FROM contacts WHERE account_id = $1 ORDER BY first_name, last_name', [req.params.id]),
    db.query('SELECT * FROM activity_log WHERE account_id = $1 ORDER BY created_at DESC', [req.params.id]),
  ]);
  res.json({ ...account.rows[0], contacts: contacts.rows, activities: activities.rows });
});

app.post('/api/accounts', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Account name is required' });
  const result = await db.query(`INSERT INTO accounts (name, name_normalized, category, status, industry, partner, crm_id, notes)
    VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),$8) RETURNING *`,
    [name, normalizeAccountName(name), req.body.category || 'NN', req.body.status || 'Prospect', req.body.industry || '', req.body.partner || '', req.body.crm_id || '', req.body.notes || '']);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/accounts/:id', async (req, res) => {
  const allowed = ['name', 'category', 'status', 'industry', 'partner', 'crm_id', 'notes'];
  const entries = Object.entries(req.body).filter(([field]) => allowed.includes(field));
  if (!entries.length) return res.status(400).json({ error: 'No editable fields supplied' });
  const sets = entries.map(([field], index) => `${field} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  if (req.body.name) {
    sets.push(`name_normalized = $${values.length + 1}`);
    values.push(normalizeAccountName(req.body.name));
  }
  values.push(req.params.id);
  const result = await db.query(`UPDATE accounts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
  res.json(result.rows[0]);
});

app.post('/api/accounts/bulk-status', async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length || !STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Select accounts and a valid status' });
  const result = await db.query('UPDATE accounts SET status = $1, updated_at = NOW() WHERE id = ANY($2::bigint[]) RETURNING id', [req.body.status, ids]);
  res.json({ updated: result.rows.length });
});

app.post('/api/accounts/:id/contacts', async (req, res) => {
  const result = await db.query(`INSERT INTO contacts (account_id, first_name, last_name, title, email, phone, linkedin)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.params.id, req.body.first_name || '', req.body.last_name || '', req.body.title || '', req.body.email || '', req.body.phone || '', req.body.linkedin || '']);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/contacts/:id', async (req, res) => {
  const allowed = ['first_name', 'last_name', 'title', 'email', 'phone', 'linkedin'];
  const entries = Object.entries(req.body).filter(([field]) => allowed.includes(field));
  const values = entries.map(([, value]) => value);
  values.push(req.params.id);
  const result = await db.query(`UPDATE contacts SET ${entries.map(([field], i) => `${field} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
  res.json(result.rows[0]);
});

app.delete('/api/contacts/:id', async (req, res) => {
  await db.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

app.post('/api/accounts/:id/activities', async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Activity note cannot be empty' });
  const result = await db.query('INSERT INTO activity_log (account_id, body, activity_type) VALUES ($1,$2,$3) RETURNING *', [req.params.id, body, req.body.activity_type || 'note']);
  res.status(201).json(result.rows[0]);
});

app.get('/api/filters', async (_req, res) => {
  const [partners, industries] = await Promise.all([
    db.query("SELECT DISTINCT partner AS value FROM accounts WHERE partner <> '' ORDER BY partner"),
    db.query("SELECT DISTINCT industry AS value FROM accounts WHERE industry <> '' ORDER BY industry"),
  ]);
  res.json({ categories: CATEGORIES, statuses: STATUSES, partners: partners.rows.map((r: any) => r.value), industries: industries.rows.map((r: any) => r.value) });
});

app.get('/api/dashboard', async (_req, res) => {
  const [total, categories, statuses, contacts, territorySegments, recent] = await Promise.all([
    db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM accounts'),
    db.query('SELECT category AS label, COUNT(*)::int AS count FROM accounts GROUP BY category ORDER BY count DESC'),
    db.query('SELECT status AS label, COUNT(*)::int AS count FROM accounts GROUP BY status ORDER BY count DESC'),
    db.query<{ count: number }>('SELECT COUNT(DISTINCT account_id)::int AS count FROM contacts'),
    db.query<{ active_ib: number; dormant_ib: number; crm_nnn: number; profiled_non_crm: number; new_non_crm: number }>(`SELECT
      COUNT(*) FILTER (WHERE category = 'Active')::int AS active_ib,
      COUNT(*) FILTER (WHERE category = 'IB')::int AS dormant_ib,
      COUNT(*) FILTER (WHERE category = 'NN')::int AS crm_nnn,
      COUNT(*) FILTER (WHERE category = 'Non-CRM' AND EXISTS (SELECT 1 FROM contacts WHERE contacts.account_id = accounts.id))::int AS profiled_non_crm,
      COUNT(*) FILTER (WHERE category = 'Non-CRM' AND NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.account_id = accounts.id))::int AS new_non_crm
      FROM accounts`),
    db.query('SELECT id, name, category, status, updated_at FROM accounts ORDER BY updated_at DESC LIMIT 6'),
  ]);
  res.json({ total: total.rows[0].count, byCategory: categories.rows, byStatus: statuses.rows, withContacts: contacts.rows[0].count, territorySegments: territorySegments.rows[0], recent: recent.rows });
});

app.post('/api/import', upload.array('files'), async (req, res) => {
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) return res.status(400).json({ error: 'Choose at least one Excel file' });
  const runs = [];
  for (const file of files) {
    try {
      const parsed = await parseWorkbook(file.buffer, file.originalname);
      runs.push(await saveImport(parsed, file.originalname));
    } catch (error) {
      runs.push({ filename: file.originalname, error: error instanceof Error ? error.message : 'Import failed' });
    }
  }
  res.json({ runs });
});

app.get('/api/import-runs', async (_req, res) => {
  const result = await db.query('SELECT * FROM import_runs ORDER BY imported_at DESC LIMIT 50');
  res.json(result.rows);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

const port = Number(process.env.PORT || 4100);
app.listen(port, () => console.log(`Territory Desk API running at http://localhost:${port}`));
