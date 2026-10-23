import ExcelJS from 'exceljs';
import { normalizeAccountName } from './db.js';
import type { AccountStatus, Category, ParsedAccount, ParsedContact, ParsedWorkbook } from './types.js';

type Row = Record<string, unknown>;

const clean = (value: unknown) => (value == null ? '' : String(value).trim());
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function indexed(row: Row) {
  const result = new Map<string, unknown>();
  for (const [header, value] of Object.entries(row)) result.set(key(header), value);
  return result;
}

function pick(row: Row, candidates: string[]) {
  const map = indexed(row);
  for (const candidate of candidates) {
    const exact = map.get(key(candidate));
    if (exact !== undefined && clean(exact)) return clean(exact);
  }
  for (const candidate of candidates) {
    const wanted = key(candidate);
    for (const [header, value] of map) {
      if (wanted.length >= 4 && header.includes(wanted) && clean(value)) return clean(value);
    }
  }
  return '';
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' };
}

function contactFromRow(row: Row): ParsedContact | null {
  const first = pick(row, ['First Name', 'Contact First Name']);
  const last = pick(row, ['Last Name', 'Contact Last Name']);
  const full = pick(row, ['Contact Name', 'Contact', 'Full Name']);
  const parsed = first || last ? { firstName: first, lastName: last } : splitName(full);
  const linkedIn = pick(row, ['LinkedIn Contact Profile URL', 'Linkedin Profile', 'LinkedIn']);
  const contact = {
    ...parsed,
    title: pick(row, ['Job Title', 'Title', 'Position']),
    email: pick(row, ['Email Address', 'Email', 'Business Email']),
    phone: pick(row, ['Mobile Phone', 'Mobile phone', 'Direct Phone Number', 'Work Phone', 'Phone']),
    linkedin: /linkedin\.com\//i.test(linkedIn) ? (linkedIn.startsWith('http') ? linkedIn : `https://${linkedIn}`) : '',
  };
  return Object.values(contact).some(Boolean) ? contact : null;
}

function mapStatus(value: string): AccountStatus {
  const v = key(value);
  if (v.includes('closed won') || v === 'won') return 'Closed Won';
  if (v.includes('proposal') || v.includes('quotation')) return 'Proposal';
  if (v.includes('meeting') || v.includes('scheduled')) return 'Meeting Scheduled';
  if (v.includes('interested') && !v.includes('not')) return 'Interested';
  if (v.includes('not interested') || v.includes('disqualified') || v.includes('lost')) return 'Not Interested';
  return 'Prospect';
}

function mapCategory(row: Row): Category {
  const explicit = key(pick(row, ['Type (IB/NN)', 'Category', 'Type']));
  const status = key(pick(row, ['Status', 'Account Status', 'Blitz customer status']));
  const tier = key(pick(row, ['Tier', 'Priority']));
  if (explicit === 'active' || status === 'active') return 'Active';
  if (status.includes('dormant')) return 'IB';
  if (tier.includes('tier 3')) return 'Non-CRM';
  if (tier.includes('tier 1') || tier.includes('tier 2')) return 'NN';
  if (explicit === 'ib' || explicit.includes('installed')) return 'IB';
  if (explicit === 'non crm') return 'Non-CRM';
  if (explicit === 'nn' || explicit.includes('net new')) return 'NN';
  return 'NN';
}

function joinNotes(row: Row) {
  return [
    pick(row, ['Notes / Next Action', 'Notes', 'Comments', 'Next Action']),
    pick(row, ['SAP Products', 'SAP products']) ? `SAP products: ${pick(row, ['SAP Products', 'SAP products'])}` : '',
  ].filter(Boolean).join('\n');
}

function accountFromRow(row: Row): ParsedAccount | null {
  const name = pick(row, ['Account Name', 'Account', 'Company Name', 'CRM Leading Planning Entity Name', 'Company']);
  if (!name || key(name) === 'grand total') return null;
  const contact = contactFromRow(row);
  return {
    name,
    category: mapCategory(row),
    categoryDeclared: Boolean(pick(row, ['Type (IB/NN)', 'Category', 'Type', 'Status', 'Account Status', 'Blitz customer status', 'Tier', 'Priority'])),
    status: mapStatus(pick(row, ['Status', 'Account Status', 'Blitz customer status'])),
    industry: pick(row, ['Industry Master Code Desc', 'Primary Industry', 'Company Industry', 'Industry']),
    partner: pick(row, ['Business Partner', 'Partner']),
    crmId: pick(row, ['CRM ID', 'Account ID', 'AccountID', 'BPID']),
    notes: joinNotes(row),
    contacts: contact ? [contact] : [],
  };
}

function rowsForSheet(workbook: ExcelJS.Workbook, sheetName: string) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return [];
  let headerRow = 1;
  for (let rowNumber = 1; rowNumber <= Math.min(10, sheet.actualRowCount); rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values as unknown[];
    if (values.slice(1).some((value) => clean(value))) { headerRow = rowNumber; break; }
  }
  const headers = (sheet.getRow(headerRow).values as unknown[]).slice(1).map(clean);
  const rows: Row[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row: Row = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = sheet.getRow(rowNumber).getCell(index + 1).text.trim();
      row[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  return rows;
}

function detectFormat(filename: string, workbook: ExcelJS.Workbook) {
  const lower = filename.toLowerCase();
  if (lower.includes('tracker')) return 'tracker';
  if (lower.includes('merged')) return 'merged';
  if (lower.includes('dit') || /^p29\d\d/i.test(filename)) return 'dit';
  if (lower.includes('blitz')) return 'blitz';
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  const headers = workbook.worksheets.flatMap((sheet) => {
    const first = (sheet.getRow(1).values as unknown[]).slice(1);
    return first.map((v) => key(clean(v)));
  });
  if (headers.includes('crm leading planning entity name') || sheetNames.some((s) => key(s) === 'account list')) return 'dit';
  if (headers.includes('type ib nn')) return 'merged';
  if (headers.includes('tier') && headers.includes('account name')) return 'tracker';
  return 'generic';
}

function mergeParsed(accounts: ParsedAccount[]) {
  const merged = new Map<string, ParsedAccount>();
  for (const account of accounts) {
    const matchKey = account.crmId ? `crm:${account.crmId}` : `name:${normalizeAccountName(account.name)}`;
    const existing = merged.get(matchKey);
    if (!existing) {
      merged.set(matchKey, account);
      continue;
    }
    const rank: Record<Category, number> = { 'Non-CRM': 0, NN: 1, IB: 2, Active: 3 };
    if (account.categoryDeclared && rank[account.category] > rank[existing.category]) existing.category = account.category;
    existing.categoryDeclared ||= account.categoryDeclared;
    if (!existing.industry) existing.industry = account.industry;
    if (!existing.partner) existing.partner = account.partner;
    if (!existing.crmId) existing.crmId = account.crmId;
    if (account.notes && !existing.notes.includes(account.notes)) existing.notes = [existing.notes, account.notes].filter(Boolean).join('\n');
    existing.contacts.push(...account.contacts);
  }
  return [...merged.values()];
}

function parseDit(workbook: ExcelJS.Workbook): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const byCrm = new Map<string, ParsedAccount>();
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  const accountSheet = sheetNames.find((name) => key(name) === 'account list');
  if (accountSheet) {
    for (const row of rowsForSheet(workbook, accountSheet)) {
      const account = accountFromRow(row);
      if (!account) continue;
      account.category = 'NN';
      accounts.push(account);
      if (account.crmId) byCrm.set(account.crmId, account);
    }
  }
  for (const sheetName of sheetNames.filter((name) => !['account list', 'enrichment rate'].includes(key(name)))) {
    for (const row of rowsForSheet(workbook, sheetName)) {
      const contact = contactFromRow(row);
      const crmId = pick(row, ['CRM ID', 'Account ID', 'AccountID', 'BPID']);
      const accountName = pick(row, ['Account Name', 'Company Name', 'CRM Leading Planning Entity Name', 'Company']);
      let account = crmId ? byCrm.get(crmId) : undefined;
      if (!account && accountName) {
        account = accountFromRow(row) || undefined;
        if (account) {
          account.category = 'NN';
          accounts.push(account);
          if (account.crmId) byCrm.set(account.crmId, account);
        }
      }
      if (account && contact) account.contacts.push(contact);
    }
  }
  return accounts;
}

export async function parseWorkbook(buffer: Buffer, filename: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const format = detectFormat(filename, workbook);
  const warnings: string[] = [];
  let accounts: ParsedAccount[] = [];
  if (format === 'dit') {
    accounts = parseDit(workbook);
  } else {
    const preferred = workbook.worksheets.map((sheet) => sheet.name).filter((name) => !/duplicate|legend|summary|enrichment/i.test(name));
    for (const sheetName of preferred) {
      for (const row of rowsForSheet(workbook, sheetName)) {
        const account = accountFromRow(row);
        if (account) accounts.push(account);
      }
    }
  }
  accounts = mergeParsed(accounts);
  if (!accounts.length) warnings.push('No account rows were recognized. Check that the workbook includes an account or company name column.');
  return { format, accounts, warnings };
}
