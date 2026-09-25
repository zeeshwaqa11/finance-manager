import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsApi } from '../api/index.js';
import Accounts from './Accounts.jsx';

vi.mock('../api/index.js', () => ({
  accountsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const accounts = [
  { id: 1, name: 'Main Checking', type: 'Bank', openingBalance: 2500, balance: 8777.5, transactionCount: 15 },
  { id: 2, name: 'Visa Card', type: 'Credit Card', openingBalance: 0, balance: -1623.35, transactionCount: 29 },
  { id: 3, name: 'Empty', type: 'Cash', openingBalance: 10, balance: 10, transactionCount: 0 },
];

const rowFor = (name) => screen.getByText(name).closest('tr');

beforeEach(() => {
  vi.clearAllMocks();
  accountsApi.list.mockResolvedValue(accounts);
  accountsApi.remove.mockResolvedValue(null);
});

describe('Accounts page', () => {
  it('lists accounts with type, transaction count and balance', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    const row = rowFor('Main Checking');
    expect(within(row).getByText('Bank')).toBeInTheDocument();
    expect(within(row).getByText('15')).toBeInTheDocument();
    expect(within(row).getByText('$8,777.50')).toBeInTheDocument();
  });

  it('marks negative balances and sums a net worth total', async () => {
    render(<Accounts />);
    await screen.findByText('Visa Card');
    expect(within(rowFor('Visa Card')).getByText('-$1,623.35')).toHaveClass('negative');
    expect(within(rowFor('Net worth')).getByText('$7,164.15')).toBeInTheDocument();
  });

  it('shows an empty state with no accounts', async () => {
    accountsApi.list.mockResolvedValue([]);
    render(<Accounts />);
    expect(await screen.findByText(/No accounts yet/)).toBeInTheDocument();
  });

  it('asks for confirmation naming the transactions, then cascades the delete', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(within(rowFor('Main Checking')).getByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('15 transactions'));
    await waitFor(() => expect(accountsApi.remove).toHaveBeenCalledWith(1, { cascade: true }));
    await waitFor(() => expect(accountsApi.list).toHaveBeenCalledTimes(2));
  });

  it('uses a singular noun for one transaction and skips cascade when there are none', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    accountsApi.list.mockResolvedValue([
      { ...accounts[0], id: 7, name: 'One', transactionCount: 1 },
      accounts[2],
    ]);
    render(<Accounts />);
    await screen.findByText('One');
    await userEvent.click(within(rowFor('One')).getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringMatching(/its 1 transaction\?/));

    await userEvent.click(within(rowFor('Empty')).getByRole('button', { name: 'Delete' }));
    expect(accountsApi.remove).toHaveBeenLastCalledWith(3, { cascade: false });
  });

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(within(rowFor('Main Checking')).getByRole('button', { name: 'Delete' }));
    expect(accountsApi.remove).not.toHaveBeenCalled();
  });

  it('shows the error when a delete fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    accountsApi.remove.mockRejectedValue(new Error('Account has transactions'));
    render(<Accounts />);
    await screen.findByText('Empty');
    await userEvent.click(within(rowFor('Empty')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Account has transactions');
  });

  it('opens the add form in a dialog and closes it on cancel', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    const dialog = document.querySelector('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Add account' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('opens the edit form prefilled for the chosen account', async () => {
    render(<Accounts />);
    await screen.findByText('Visa Card');
    await userEvent.click(within(rowFor('Visa Card')).getByRole('button', { name: 'Edit' }));
    const dialog = document.querySelector('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edit account' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Visa Card');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('Credit Card');
  });

  it('reloads the list after saving a new account', async () => {
    accountsApi.create.mockResolvedValue({});
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    const dialog = document.querySelector('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Savings');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add account' }));

    await waitFor(() => expect(accountsApi.create).toHaveBeenCalled());
    await waitFor(() => expect(accountsApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  });

  it('shows a load error', async () => {
    accountsApi.list.mockRejectedValue(new Error('Cannot reach the server'));
    render(<Accounts />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
