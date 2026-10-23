import { BarChart3, Building2, FileUp, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const navigation = [
  { to: '/', label: 'Overview', icon: BarChart3 },
  { to: '/accounts', label: 'Accounts', icon: Building2 },
  { to: '/import', label: 'Import', icon: FileUp },
];

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TD</div>
          <div className="brand-copy"><strong>Territory Desk</strong><span>Account workspace</span></div>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="local-status"><span />Stored locally</div>
          <button className="icon-button collapse-button" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <form className="global-search" onSubmit={(event) => { event.preventDefault(); navigate(`/accounts?search=${encodeURIComponent(query)}`); }}>
            <Search size={17} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search accounts, CRM IDs, or notes" aria-label="Search all accounts" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
            <kbd>↵</kbd>
          </form>
          <div className="topbar-meta"><span>Browser-local workspace</span><div className="avatar" aria-label="Account executive">AE</div></div>
        </header>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
