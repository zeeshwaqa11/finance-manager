import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Icon, { Logo } from './components/Icon.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Accounts from './pages/Accounts.jsx';
import Budgets from './pages/Budgets.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/accounts', label: 'Accounts', icon: 'wallet' },
  { to: '/transactions', label: 'Transactions', icon: 'swap' },
  { to: '/budgets', label: 'Budgets', icon: 'pie' },
];

export default function App() {
  return (
    <ToastProvider>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <Logo />
            <span className="brand-name">Finance Manager</span>
          </span>
          <nav className="main-nav" aria-label="Main">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </ToastProvider>
  );
}
