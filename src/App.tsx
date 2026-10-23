import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { AccountsPage } from './pages/AccountsPage';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { ImportPage } from './pages/ImportPage';

export default function App() {
  return <HashRouter><Routes><Route element={<Layout />}><Route index element={<DashboardPage />} /><Route path="accounts" element={<AccountsPage />} /><Route path="accounts/:id" element={<AccountDetailPage />} /><Route path="import" element={<ImportPage />} /></Route></Routes></HashRouter>;
}
