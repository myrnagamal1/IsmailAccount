import { Check, ChevronDown, Download, Plus, Search, SlidersHorizontal, UsersRound, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { CategoryBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import type { Account, Status } from '../types';

interface Filters { categories: string[]; statuses: string[]; partners: string[]; industries: string[] }

export function AccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filters, setFilters] = useState<Filters>({ categories: [], statuses: [], partners: [], industries: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<Status>('Interested');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const search = searchParams.get('search') || '';

  const load = useCallback(async () => {
    setLoading(true);
    const [rows, options] = await Promise.all([api.get<Account[]>(`/api/accounts?${searchParams.toString()}`), api.get<Filters>('/api/filters')]);
    setAccounts(rows); setFilters(options); setLoading(false);
  }, [searchParams]);
  useEffect(() => { setPage(1); load(); }, [load]);

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(name, value) : next.delete(name);
    setSearchParams(next);
  };

  const exportCsv = () => {
    const headers = ['Account Name', 'Category', 'Status', 'Industry', 'Partner', 'CRM ID', 'Notes'];
    const values = accounts.map((a) => [a.name, a.category, a.status, a.industry, a.partner, a.crm_id || '', a.notes]);
    const csv = [headers, ...values].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `territory-accounts-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const bulkUpdate = async () => {
    await api.post('/api/accounts/bulk-status', { ids: [...selected], status: bulkStatus });
    setSelected(new Set()); await load();
  };

  const allSelected = accounts.length > 0 && selected.size === accounts.length;
  const pageCount = Math.max(1, Math.ceil(accounts.length / pageSize));
  const visibleAccounts = accounts.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount = ['category', 'status', 'partner', 'industry', 'hasContacts'].filter((key) => searchParams.has(key)).length;
  const filterGroups = useMemo(() => [
    ['category', 'Category', filters.categories], ['status', 'Status', filters.statuses], ['partner', 'Partner', filters.partners], ['industry', 'Industry', filters.industries],
  ] as const, [filters]);

  return <div className="page accounts-page">
    <div className="page-heading"><div><h1>Accounts</h1><p>{loading ? 'Loading territory…' : `${accounts.length.toLocaleString()} accounts in this view`}</p></div><Link className="button primary" to="/import"><Plus size={16} />Add accounts</Link></div>
    <div className="accounts-toolbar">
      <label className="search-control"><Search size={16} /><input value={search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search this view" /><span>{accounts.length}</span></label>
      <button className={`button secondary ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal size={16} />Filters{activeFilterCount > 0 && <span className="count-badge">{activeFilterCount}</span>}</button>
      <button className={`button secondary ${searchParams.get('hasContacts') === 'true' ? 'active' : ''}`} onClick={() => setFilter('hasContacts', searchParams.get('hasContacts') === 'true' ? '' : 'true')}><UsersRound size={16} />With contacts</button>
      <button className="button secondary" onClick={exportCsv} disabled={!accounts.length}><Download size={16} />Export CSV</button>
    </div>
    {showFilters && <div className="filter-panel">{filterGroups.map(([keyName, label, options]) => <label key={keyName}><span>{label}</span><div className="select-wrap"><select value={searchParams.get(keyName) || ''} onChange={(e) => setFilter(keyName, e.target.value)}><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></div></label>)}</div>}
    {activeFilterCount > 0 && <div className="active-filters">{['category', 'status', 'partner', 'industry', 'hasContacts'].map((keyName) => searchParams.get(keyName) && <button key={keyName} onClick={() => setFilter(keyName, '')}>{keyName === 'hasContacts' ? 'With contacts' : searchParams.get(keyName)}<X size={13} /></button>)}<button className="clear-filters" onClick={() => setSearchParams(search ? { search } : {})}>Clear filters</button></div>}
    {selected.size > 0 && <div className="bulk-bar"><span><Check size={15} />{selected.size} selected</span><div><select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as Status)}>{filters.statuses.map((s) => <option key={s}>{s}</option>)}</select><button className="button primary small" onClick={bulkUpdate}>Update status</button><button className="icon-button" onClick={() => setSelected(new Set())} aria-label="Clear selection"><X size={16} /></button></div></div>}
    <div className="table-shell">
      <table className="accounts-table"><thead><tr><th className="check-cell"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(accounts.map((a) => a.id)))} aria-label="Select all accounts" /></th><th>Account</th><th>Category</th><th>Status</th><th>Industry</th><th>Partner</th><th>Contacts</th><th>Updated</th></tr></thead>
      <tbody>{loading ? Array.from({ length: 7 }).map((_, i) => <tr key={i} className="skeleton-row"><td /><td><span /></td><td><span /></td><td><span /></td><td><span /></td><td><span /></td><td /><td /></tr>) : visibleAccounts.map((account) => <tr key={account.id} className={selected.has(account.id) ? 'selected' : ''}><td className="check-cell"><input type="checkbox" checked={selected.has(account.id)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(account.id) ? next.delete(account.id) : next.add(account.id); return next; })} aria-label={`Select ${account.name}`} /></td><td><Link to={`/accounts/${account.id}`} className="account-link"><span>{account.name}</span>{account.crm_id && <small>CRM {account.crm_id}</small>}</Link></td><td><CategoryBadge value={account.category} /></td><td><StatusBadge value={account.status} /></td><td>{account.industry || <span className="empty-value">—</span>}</td><td>{account.partner || <span className="empty-value">—</span>}</td><td><span className="contact-count"><UsersRound size={14} />{account.contact_count || 0}</span></td><td>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(account.updated_at))}</td></tr>)}</tbody></table>
      {!loading && !accounts.length && <EmptyState icon={Search} title="No accounts found" description="Try removing a filter or import another workbook to expand your territory." />}
    </div>
    {!loading && accounts.length > pageSize && <nav className="pagination" aria-label="Accounts pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, accounts.length)} of {accounts.length.toLocaleString()}</span><div><button className="button secondary small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="button secondary small" disabled={page === pageCount} onClick={() => setPage((p) => p + 1)}>Next</button></div></nav>}
  </div>;
}
