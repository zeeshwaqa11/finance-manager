import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

vi.mock('./pages/Dashboard.jsx', () => ({ default: () => <h1>Dashboard page</h1> }));
vi.mock('./pages/Accounts.jsx', () => ({ default: () => <h1>Accounts page</h1> }));
vi.mock('./pages/Transactions.jsx', () => ({ default: () => <h1>Transactions page</h1> }));
vi.mock('./pages/Budgets.jsx', () => ({ default: () => <h1>Budgets page</h1> }));

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('App shell', () => {
  it('renders the brand and the four main links', () => {
    renderAt();
    expect(screen.getByText('Finance Manager')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Dashboard', 'Accounts', 'Transactions', 'Budgets']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/accounts', '/transactions', '/budgets']);
  });

  it('shows an icon beside every link', () => {
    renderAt();
    for (const link of within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')) {
      expect(link.querySelector('svg')).not.toBeNull();
    }
  });

  it('starts on the dashboard and marks its link as active', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Accounts' })).not.toHaveClass('active');
  });

  it.each([
    ['/accounts', 'Accounts page', 'Accounts'],
    ['/transactions', 'Transactions page', 'Transactions'],
    ['/budgets', 'Budgets page', 'Budgets'],
  ])('renders %s and highlights its link', (path, heading, link) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: link })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveClass('active');
  });

  it('navigates when a link is clicked', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('link', { name: 'Budgets' }));
    expect(screen.getByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Budgets' })).toHaveClass('active');
  });

  it('redirects unknown routes to the dashboard', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
  });

  it('has a working theme toggle in the header', async () => {
    renderAt();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('renders the page inside the main landmark', () => {
    renderAt('/accounts');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Accounts page' })).toBeInTheDocument();
  });
});
