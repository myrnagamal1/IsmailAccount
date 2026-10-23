import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, ExternalLink, Mail, MessageSquareText, Phone, Plus, Save, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { CategoryBadge } from '../components/CategoryBadge';
import { StatusBadge } from '../components/StatusBadge';
import type { AccountDetail, Category, Contact, Status } from '../types';

const categories: Category[] = ['IB', 'NN', 'Non-CRM', 'Active'];
const statuses: Status[] = ['Prospect', 'Interested', 'Meeting Scheduled', 'Proposal', 'Closed Won', 'Not Interested'];
const blankContact = { first_name: '', last_name: '', title: '', email: '', phone: '', linkedin: '' };

export function AccountDetailPage() {
  const { id } = useParams();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [draft, setDraft] = useState<Partial<AccountDetail>>({});
  const [editing, setEditing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [newContact, setNewContact] = useState(blankContact);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const load = () => api.get<AccountDetail>(`/api/accounts/${id}`).then((value) => { setAccount(value); setDraft(value); });
  useEffect(() => { load(); }, [id]);
  if (!account) return <div className="page"><div className="page-skeleton"><span /><span /><span /></div></div>;

  const saveAccount = async () => {
    const updated = await api.patch<AccountDetail>(`/api/accounts/${id}`, draft);
    setAccount({ ...account, ...updated }); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 1800);
  };
  const addContact = async () => { await api.post(`/api/accounts/${id}/contacts`, newContact); setNewContact(blankContact); setShowContact(false); load(); };
  const deleteContact = async (contactId: string) => { await api.delete(`/api/contacts/${contactId}`); load(); };
  const addActivity = async () => { if (!note.trim()) return; await api.post(`/api/accounts/${id}/activities`, { body: note }); setNote(''); load(); };

  return <div className="page detail-page">
    <Link to="/accounts" className="back-link"><ArrowLeft size={15} />Back to accounts</Link>
    <header className="detail-header"><div className="detail-identity"><div className="large-monogram">{account.name.slice(0, 2).toUpperCase()}</div><div><div className="detail-title-line"><h1>{account.name}</h1>{saved && <span className="saved-indicator"><Check size={13} />Saved</span>}</div><div className="badge-line"><CategoryBadge value={account.category} /><StatusBadge value={account.status} />{account.crm_id && <span className="crm-reference">CRM {account.crm_id}</span>}</div></div></div><button className="button secondary" onClick={() => editing ? saveAccount() : setEditing(true)}>{editing ? <><Save size={16} />Save changes</> : 'Edit account'}</button></header>

    <div className="detail-grid">
      <div className="detail-main">
        <section className="detail-section"><div className="section-heading"><div><h2>Account profile</h2><p>Core territory information</p></div></div>
          <div className="profile-grid">
            <label className="field field-wide"><span>Account name</span><input disabled={!editing} value={String(draft.name || '')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="field"><span>Category</span><select disabled={!editing} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>{categories.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>Status</span><select disabled={!editing} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="field"><span>Industry</span><input disabled={!editing} value={String(draft.industry || '')} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} placeholder="Add industry" /></label>
            <label className="field"><span>Partner</span><input disabled={!editing} value={String(draft.partner || '')} onChange={(e) => setDraft({ ...draft, partner: e.target.value })} placeholder="Add partner" /></label>
            <label className="field"><span>CRM ID</span><input disabled={!editing} value={String(draft.crm_id || '')} onChange={(e) => setDraft({ ...draft, crm_id: e.target.value })} placeholder="Add CRM ID" /></label>
            <label className="field field-full"><span>Notes</span><textarea disabled={!editing} rows={5} value={String(draft.notes || '')} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Account context, SAP products, and next steps" /></label>
          </div>{editing && <div className="edit-actions"><button className="button ghost" onClick={() => { setDraft(account); setEditing(false); }}>Cancel</button><button className="button primary" onClick={saveAccount}><Save size={16} />Save changes</button></div>}
        </section>

        <section className="detail-section"><div className="section-heading"><div><h2>Contacts</h2><p>{account.contacts.length} people linked to this account</p></div><button className="button secondary small" onClick={() => setShowContact(true)}><Plus size={15} />Add contact</button></div>
          {showContact && <div className="inline-form"><div className="inline-form-head"><strong>New contact</strong><button className="icon-button" onClick={() => setShowContact(false)} aria-label="Close"><X size={16} /></button></div><div className="contact-form-grid">{Object.keys(blankContact).map((field) => <label key={field} className={field === 'linkedin' ? 'field-wide' : ''}><span>{field.replace('_', ' ')}</span><input value={newContact[field as keyof typeof newContact]} onChange={(e) => setNewContact({ ...newContact, [field]: e.target.value })} /></label>)}</div><button className="button primary small" onClick={addContact} disabled={!newContact.first_name && !newContact.email}>Save contact</button></div>}
          <div className="contact-list">{account.contacts.map((contact: Contact) => <article key={contact.id} className="contact-card"><div className="contact-avatar"><UserRound size={18} /></div><div className="contact-primary"><strong>{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}</strong><span>{contact.title || 'No title'}</span></div><div className="contact-methods">{contact.email && <a href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a>}{contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noreferrer"><ExternalLink size={14} />LinkedIn</a>}</div><button className="icon-button danger" onClick={() => deleteContact(contact.id)} aria-label={`Delete ${contact.first_name}`}><Trash2 size={15} /></button></article>)}{!account.contacts.length && <div className="inline-empty"><UserRound size={20} /><div><strong>No contacts yet</strong><span>Add a decision-maker or import a DIT workbook.</span></div></div>}</div>
        </section>
      </div>
      <aside className="activity-panel"><div className="section-heading"><div><h2>Activity</h2><p>Notes and follow-up history</p></div></div><div className="note-composer"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a call note or next action…" /><button className="button primary small" onClick={addActivity} disabled={!note.trim()}><MessageSquareText size={15} />Add note</button></div><div className="activity-list">{account.activities.map((activity) => <div className="activity-item" key={activity.id}><span className="activity-icon"><MessageSquareText size={14} /></span><div><p>{activity.body}</p><time>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.created_at))}</time></div></div>)}{!account.activities.length && <div className="activity-empty"><CalendarDays size={21} /><p>No activity yet. Add the latest conversation or next action.</p></div>}</div><div className="account-meta"><div><BriefcaseBusiness size={14} /><span>Created {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(account.created_at))}</span></div></div></aside>
    </div>
  </div>;
}
