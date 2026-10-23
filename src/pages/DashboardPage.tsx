import { ArrowRight, Building2, ContactRound, FileUp, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { CategoryBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import type { Account, Category, Status } from '../types';

interface Dashboard {
  total: number;
  withContacts: number;
  territorySegments: {
    active_ib: number;
    dormant_ib: number;
    crm_nnn: number;
    profiled_non_crm: number;
    new_non_crm: number;
  };
  byCategory: { label: Category; count: number }[];
  byStatus: { label: Status; count: number }[];
  recent: Account[];
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => { api.get<Dashboard>('/api/dashboard').then(setData); }, []);
  if (!data) return <div className="page"><div className="page-skeleton"><span /><span /><span /></div></div>;

  const contactCoverage = data.total ? Math.round((data.withContacts / data.total) * 100) : 0;
  return <div className="page dashboard-page">
    <div className="page-heading"><div><p className="context-line">Friday, 23 October</p><h1>Territory overview</h1><p>Coverage, momentum, and the accounts most recently touched.</p></div><Link className="button primary" to="/import"><FileUp size={16} />Import accounts</Link></div>
    <section className="metrics-strip" aria-label="Territory metrics">
      <div className="metric-main"><Building2 size={20} /><div><strong>{data.total.toLocaleString()}</strong><span>Total accounts</span></div></div>
      <Link to="/accounts?hasContacts=true" className="metric-link"><strong>{data.withContacts.toLocaleString()}</strong><span>With contacts</span></Link>
      <Link to="/accounts?hasContacts=true" className="metric-link"><strong>{contactCoverage}%</strong><span>Contact coverage</span></Link>
      <div><strong>{data.byStatus.find((x) => x.label === 'Meeting Scheduled')?.count || 0}</strong><span>Meetings scheduled</span></div>
    </section>

    <section className="classification-section" aria-labelledby="classification-title">
      <div className="section-heading"><div><h2 id="classification-title">Territory classification</h2><p>Account groups used for coverage planning</p></div></div>
      <div className="classification-strip">
        <Link to="/accounts?category=Active" title="Active installed-base accounts"><strong>{data.territorySegments.active_ib.toLocaleString()}</strong><span>Active IB</span></Link>
        <Link to="/accounts?category=IB" title="Dormant installed-base accounts"><strong>{data.territorySegments.dormant_ib.toLocaleString()}</strong><span>Dormant IB</span></Link>
        <Link to="/accounts?category=NN" title="Net-new accounts tracked in CRM"><strong>{data.territorySegments.crm_nnn.toLocaleString()}</strong><span>CRM NNN</span></Link>
        <Link to="/accounts?category=Non-CRM&hasContacts=true" title="Non-CRM accounts with at least one profiled contact"><strong>{data.territorySegments.profiled_non_crm.toLocaleString()}</strong><span>Profiled Non-CRM</span></Link>
        <Link to="/accounts?category=Non-CRM&hasContacts=false" title="Non-CRM accounts without a profiled contact"><strong>{data.territorySegments.new_non_crm.toLocaleString()}</strong><span>New Non-CRM</span></Link>
      </div>
    </section>

    {data.total === 0 ? <EmptyState icon={Target} title="Build your territory view" description="Import your tracker, merged account file, or DIT workbooks. Territory Desk will merge duplicates and connect contacts to the right accounts." action={<Link className="button primary" to="/import">Import your first workbook</Link>} /> : <>
      <div className="dashboard-grid">
        <section className="dashboard-section"><div className="section-heading"><div><h2>Account mix</h2><p>Priority across your territory</p></div><Link to="/accounts">View all <ArrowRight size={15} /></Link></div>
          <div className="category-list">{data.byCategory.map((item) => { const pct = Math.round(item.count / data.total * 100); return <div key={item.label} className="category-row"><CategoryBadge value={item.label} /><div className="bar-track"><span className={`bar-fill bar-${item.label.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ width: `${pct}%` }} /></div><strong>{item.count}</strong><span>{pct}%</span></div>; })}</div>
        </section>
        <section className="dashboard-section"><div className="section-heading"><div><h2>Pipeline status</h2><p>Current account disposition</p></div></div>
          <div className="status-summary">{data.byStatus.map((item) => <div key={item.label}><StatusBadge value={item.label} /><strong>{item.count}</strong></div>)}</div>
        </section>
      </div>
      <section className="recent-section"><div className="section-heading"><div><h2>Recently updated</h2><p>Your latest account changes</p></div></div>
        <div className="recent-list">{data.recent.map((account) => <Link to={`/accounts/${account.id}`} key={account.id} className="recent-account"><div className="account-monogram">{account.name.slice(0, 2).toUpperCase()}</div><div className="recent-name"><strong>{account.name}</strong><span>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(account.updated_at))}</span></div><CategoryBadge value={account.category} /><StatusBadge value={account.status} /><ArrowRight size={16} /></Link>)}</div>
      </section>
    </>}
  </div>;
}
