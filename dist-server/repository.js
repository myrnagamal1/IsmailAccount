import { db, normalizeAccountName } from './db.js';
const categoryRank = { 'Non-CRM': 0, NN: 1, IB: 2, Active: 3 };
function mergeNotes(existing, incoming) {
    if (!incoming || existing.includes(incoming))
        return existing;
    return [existing, incoming].filter(Boolean).join('\n\n');
}
export async function saveImport(parsed, filename) {
    let accountsCreated = 0;
    let accountsUpdated = 0;
    let contactsCreated = 0;
    for (const account of parsed.accounts) {
        const normalized = normalizeAccountName(account.name);
        if (!normalized)
            continue;
        const found = account.crmId
            ? await db.query('SELECT id, category, notes FROM accounts WHERE crm_id = $1 OR name_normalized = $2 ORDER BY CASE WHEN crm_id = $1 THEN 0 ELSE 1 END LIMIT 1', [account.crmId, normalized])
            : await db.query('SELECT id, category, notes FROM accounts WHERE name_normalized = $1 LIMIT 1', [normalized]);
        let accountId;
        if (found.rows[0]) {
            const current = found.rows[0];
            const category = account.categoryDeclared && categoryRank[account.category] > categoryRank[current.category]
                ? account.category
                : current.category;
            const updated = await db.query(`
        UPDATE accounts SET
          name = CASE WHEN LENGTH($1) > LENGTH(name) THEN $1 ELSE name END,
          category = $2,
          status = CASE WHEN status = 'Prospect' THEN $3 ELSE status END,
          industry = CASE WHEN industry = '' THEN $4 ELSE industry END,
          partner = CASE WHEN partner = '' THEN $5 ELSE partner END,
          crm_id = CASE WHEN COALESCE(crm_id, '') = '' THEN NULLIF($6, '') ELSE crm_id END,
          notes = $7,
          updated_at = NOW()
        WHERE id = $8 RETURNING id`, [account.name, category, account.status, account.industry, account.partner, account.crmId, mergeNotes(current.notes, account.notes), current.id]);
            accountId = updated.rows[0].id;
            accountsUpdated += 1;
        }
        else {
            const created = await db.query(`
        INSERT INTO accounts (name, name_normalized, category, status, industry, partner, crm_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8) RETURNING id`, [account.name, normalized, account.category, account.status, account.industry, account.partner, account.crmId, account.notes]);
            accountId = created.rows[0].id;
            accountsCreated += 1;
        }
        for (const contact of account.contacts) {
            const duplicate = contact.email
                ? await db.query('SELECT id FROM contacts WHERE account_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1', [accountId, contact.email])
                : await db.query('SELECT id FROM contacts WHERE account_id = $1 AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3) AND LOWER(title) = LOWER($4) LIMIT 1', [accountId, contact.firstName, contact.lastName, contact.title]);
            if (duplicate.rows.length)
                continue;
            if (!Object.values(contact).some(Boolean))
                continue;
            await db.query(`INSERT INTO contacts (account_id, first_name, last_name, title, email, phone, linkedin)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`, [accountId, contact.firstName, contact.lastName, contact.title, contact.email, contact.phone, contact.linkedin]);
            contactsCreated += 1;
        }
    }
    const run = await db.query(`INSERT INTO import_runs (filename, format, accounts_created, accounts_updated, contacts_created, warnings)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [filename, parsed.format, accountsCreated, accountsUpdated, contactsCreated, parsed.warnings.join('\n')]);
    return run.rows[0];
}
