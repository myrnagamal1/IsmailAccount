import { AlertCircle, CheckCircle2, FileSpreadsheet, History, UploadCloud, X } from 'lucide-react';
import { DragEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface ImportRun { id?: string; filename: string; format?: string; accounts_created?: number; accounts_updated?: number; contacts_created?: number; warnings?: string; imported_at?: string; error?: string }

export function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [latest, setLatest] = useState<ImportRun[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadHistory = () => api.get<ImportRun[]>('/api/import-runs').then(setRuns);
  useEffect(() => { loadHistory(); }, []);

  const addFiles = (incoming: File[]) => setFiles((current) => {
    const next = [...current];
    for (const file of incoming.filter((f) => f.name.toLowerCase().endsWith('.xlsx'))) if (!next.some((x) => x.name === file.name && x.size === file.size)) next.push(file);
    return next;
  });
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); addFiles([...event.dataTransfer.files]); };
  const upload = async () => {
    const body = new FormData(); files.forEach((file) => body.append('files', file)); setUploading(true);
    try { const response = await fetch('/api/import', { method: 'POST', body }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setLatest(result.runs); setFiles([]); loadHistory(); }
    catch (error) { setLatest([{ filename: 'Import', error: error instanceof Error ? error.message : 'Import failed' }]); }
    finally { setUploading(false); }
  };

  return <div className="page import-page">
    <div className="page-heading"><div><h1>Import accounts</h1><p>Bring in territory, tracker, DIT, partner, and enriched workbooks.</p></div></div>
    <div className="import-layout"><div className="import-main">
      <section className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept=".xlsx" multiple hidden onChange={(e) => addFiles([...(e.target.files || [])])} />
        <div className="drop-icon"><UploadCloud size={26} /></div><h2>Drop Excel files here</h2><p>or click to choose one or more .xlsx workbooks</p><span>Up to 30 MB per file</span>
      </section>
      {files.length > 0 && <section className="file-queue"><div className="section-heading"><div><h2>Ready to import</h2><p>{files.length} workbook{files.length === 1 ? '' : 's'} selected</p></div><button className="button primary" onClick={upload} disabled={uploading}>{uploading ? 'Importing…' : `Import ${files.length} file${files.length === 1 ? '' : 's'}`}</button></div>{files.map((file, index) => <div className="queued-file" key={`${file.name}-${file.size}`}><FileSpreadsheet size={20} /><div><strong>{file.name}</strong><span>{(file.size / 1024).toFixed(0)} KB</span></div><span className="detection-hint">Auto-detect</span><button className="icon-button" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={16} /></button></div>)}</section>}
      {latest.length > 0 && <section className="import-results"><div className="section-heading"><div><h2>Import results</h2><p>Accounts are matched by CRM ID and normalized name</p></div></div>{latest.map((run, i) => <div className={`result-row ${run.error ? 'error' : ''}`} key={`${run.filename}-${i}`}>{run.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}<div><strong>{run.filename}</strong><span>{run.error || `${run.format?.toUpperCase()} · ${run.accounts_created} created · ${run.accounts_updated} updated · ${run.contacts_created} contacts`}</span>{run.warnings && <small>{run.warnings}</small>}</div></div>)}</section>}
    </div>
    <aside className="import-guide"><h2>How detection works</h2><p>Territory Desk checks the filename first, then verifies the columns and sheet structure.</p><dl><div><dt>Tracker</dt><dd>Tier, account status, partner, next action, SAP products</dd></div><div><dt>Merged</dt><dd>Account, IB/NN type, contact and enrichment columns</dd></div><div><dt>DIT profiling</dt><dd>Account List plus CRM-linked ZoomInfo and MP contact sheets</dd></div><div><dt>Blitz and generic</dt><dd>Common company, contact, industry, and partner columns</dd></div></dl><div className="merge-note"><strong>Safe to re-import</strong><p>Existing accounts are updated. Notes are merged, contacts are deduplicated, and categories only move up in priority.</p></div></aside></div>
    <section className="history-section"><div className="section-heading"><div><h2><History size={18} />Import history</h2><p>Your 50 most recent local imports</p></div></div><div className="history-table"><div className="history-head"><span>Workbook</span><span>Detected</span><span>Created</span><span>Updated</span><span>Contacts</span><span>Imported</span></div>{runs.map((run) => <div className="history-row" key={run.id}><strong>{run.filename}</strong><span className="format-tag">{run.format}</span><span>{run.accounts_created}</span><span>{run.accounts_updated}</span><span>{run.contacts_created}</span><time>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(run.imported_at!))}</time></div>)}{!runs.length && <div className="history-empty">No imports yet.</div>}</div></section>
  </div>;
}
