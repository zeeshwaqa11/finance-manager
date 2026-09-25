import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsApi, categoriesApi, transactionsApi } from '../api/index.js';
import Transactions from './Transactions.jsx';

vi.mock('../api/index.js', () => ({
  accountsApi: { list: vi.fn() },
  categoriesApi: { list: vi.fn() },
  transactionsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const accounts = [
  { id: 1, name: 'Wallet' },
  { id: 2, name: 'Bank' },
];
const categories = [
  { id: 1, name: 'Food', kind: 'expense' },
  { id: 2, name: 'Salary', kind: 'income' },
];
const transactions = [
  { id: 11, accountId: 1, accountName: 'Wallet', categoryId: 1, categoryName: 'Food', amount: 82.69, type: 'expense', date: '2026-09-25', note: 'Market' },
  { id: 12, accountId: 2, accountName: 'Bank', categoryId: 2, categoryName: 'Salary', amount: 3200, type: 'income', date: '2026-09-01', note: null },
];

const lastListArgs = () => transactionsApi.list.mock.calls.at(-1)[0];

async function renderPage() {
  render(<Transactions />);
  await screen.findByText('Market');
}

beforeEach(() => {
  vi.clearAllMocks();
  accountsApi.list.mockResolvedValue(accounts);
  categoriesApi.list.mockResolvedValue(categories);
  transactionsApi.list.mockResolvedValue(transactions);
  transactionsApi.remove.mockResolvedValue(null);
});

describe('Transactions page', () => {
  it('renders rows with formatted dates and signed amounts', async () => {
    await renderPage();
    const expense = screen.getByText('Market').closest('tr');
    expect(within(expense).getByText('Sep 25, 2026')).toBeInTheDocument();
    expect(within(expense).getByText('−Rs 82.69')).toHaveClass('expense');
    const income = screen.getByText('Salary', { selector: 'td' }).closest('tr');
    expect(within(income).getByText('+Rs 3,200.00')).toHaveClass('income');
  });

  it('summarises the count and net of what is shown', async () => {
    await renderPage();
    expect(screen.getByText(/2 transactions · Net \Rs 3,117\.31/)).toBeInTheDocument();
  });

  it('uses the singular for one transaction', async () => {
    transactionsApi.list.mockResolvedValue([transactions[0]]);
    await renderPage();
    expect(screen.getByText(/1 transaction · Net -\Rs 82\.69/)).toBeInTheDocument();
  });

  it('requests newest first by default', async () => {
    await renderPage();
    expect(lastListArgs()).toMatchObject({ sort: 'date', order: 'desc' });
  });

  it('sorts by a column, then toggles direction on a second click', async () => {
    await renderPage();
    const amountHeader = screen.getByRole('button', { name: /^Amount/ });
    await userEvent.click(amountHeader);
    await waitFor(() => expect(lastListArgs()).toMatchObject({ sort: 'amount', order: 'desc' }));
    await userEvent.click(screen.getByRole('button', { name: /^Amount/ }));
    await waitFor(() => expect(lastListArgs()).toMatchObject({ sort: 'amount', order: 'asc' }));
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('starts text columns in ascending order', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /^Category/ }));
    await waitFor(() => expect(lastListArgs()).toMatchObject({ sort: 'category', order: 'asc' }));
  });

  it('passes filters to the API and can clear them', async () => {
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText('Account'), 'Bank');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Salary');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Income');
    await waitFor(() => expect(lastListArgs()).toMatchObject({ accountId: '2', categoryId: '2', type: 'income' }));

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(lastListArgs()).toMatchObject({ accountId: '', categoryId: '', type: '' }));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('passes a date range through', async () => {
    await renderPage();
    await userEvent.type(screen.getByLabelText('From'), '2026-09-01');
    await userEvent.type(screen.getByLabelText('To'), '2026-09-30');
    await waitFor(() => expect(lastListArgs()).toMatchObject({ from: '2026-09-01', to: '2026-09-30' }));
  });

  it('distinguishes an empty result from filters that match nothing', async () => {
    transactionsApi.list.mockResolvedValue([]);
    render(<Transactions />);
    expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Expense');
    expect(await screen.findByText('No transactions match these filters.')).toBeInTheDocument();
  });

  const dialog = () => document.querySelector('dialog');
  const clickRowDelete = (note) =>
    userEvent.click(within(screen.getByText(note).closest('tr')).getByRole('button', { name: 'Delete' }));

  it('asks for confirmation, then deletes and reloads', async () => {
    await renderPage();
    await clickRowDelete('Market');
    expect(within(dialog()).getByRole('heading', { name: 'Delete transaction' })).toBeInTheDocument();
    expect(within(dialog()).getByText(/\Rs 82\.69 Food transaction from Sep 25, 2026/)).toBeInTheDocument();
    expect(transactionsApi.remove).not.toHaveBeenCalled();

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(transactionsApi.remove).toHaveBeenCalledWith(11));
    await waitFor(() => expect(transactionsApi.list.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('never relies on the browser confirm() pop-up', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderPage();
    await clickRowDelete('Market');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(transactionsApi.remove).toHaveBeenCalledWith(11));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    await renderPage();
    await clickRowDelete('Market');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(dialog()).toBeNull();
    expect(transactionsApi.remove).not.toHaveBeenCalled();
  });

  it('shows a failed delete inside the dialog and keeps it open', async () => {
    transactionsApi.remove.mockRejectedValue(new Error('Transaction not found'));
    await renderPage();
    await clickRowDelete('Market');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Transaction not found');
  });

  it('opens an add dialog and a prefilled edit dialog', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(within(document.querySelector('dialog')).getByRole('heading', { name: 'Add transaction' })).toBeInTheDocument();
    await userEvent.click(within(document.querySelector('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(document.querySelector('dialog')).toBeNull();

    await userEvent.click(within(screen.getByText('Market').closest('tr')).getByRole('button', { name: 'Edit' }));
    const dialog = document.querySelector('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit transaction' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Amount (Rs)')).toHaveValue(82.69);
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('Market');
  });

  it('disables Add until accounts and categories have loaded', async () => {
    accountsApi.list.mockReturnValue(new Promise(() => {}));
    render(<Transactions />);
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeDisabled();
  });

  it('shows a load error', async () => {
    transactionsApi.list.mockRejectedValue(new Error('Cannot reach the server'));
    render(<Transactions />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
