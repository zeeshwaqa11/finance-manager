import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsApi } from '../api/index.js';
import { ToastProvider } from '../components/Toast.jsx';
import Accounts from './Accounts.jsx';

vi.mock('../api/index.js', () => ({
  accountsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const accounts = [
  { id: 1, name: 'Main Checking', type: 'Bank', openingBalance: 2500, balance: 8777.5, transactionCount: 15 },
  { id: 2, name: 'Visa Card', type: 'Credit Card', openingBalance: 0, balance: -1623.35, transactionCount: 29 },
  { id: 3, name: 'Empty', type: 'Cash', openingBalance: 10, balance: 10, transactionCount: 0 },
];

const cardFor = (name) => screen.getByRole('heading', { name }).closest('article');
const dialog = () => document.querySelector('dialog');

beforeEach(() => {
  vi.clearAllMocks();
  accountsApi.list.mockResolvedValue(accounts);
  accountsApi.remove.mockResolvedValue(null);
});

describe('Accounts page', () => {
  it('shows each account as a card with type, transaction count and balance', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    const card = cardFor('Main Checking');
    expect(within(card).getByText('Bank')).toBeInTheDocument();
    expect(within(card).getByText('15 transactions')).toBeInTheDocument();
    expect(within(card).getByText('Rs 8,777.50')).toBeInTheDocument();
  });

  it('uses the singular for a single transaction', async () => {
    accountsApi.list.mockResolvedValue([{ ...accounts[0], transactionCount: 1 }]);
    render(<Accounts />);
    await screen.findByText('Main Checking');
    expect(within(cardFor('Main Checking')).getByText('1 transaction')).toBeInTheDocument();
  });

  it('marks negative balances', async () => {
    render(<Accounts />);
    await screen.findByText('Visa Card');
    expect(within(cardFor('Visa Card')).getByText('-Rs 1,623.35')).toHaveClass('negative');
    expect(within(cardFor('Main Checking')).getByText('Rs 8,777.50')).not.toHaveClass('negative');
  });

  it('summarises net worth, assets and liabilities', async () => {
    render(<Accounts />);
    await screen.findByText('Visa Card');
    const summary = screen.getByText('Net worth').closest('section');
    expect(within(summary).getByText('Rs 7,164.15')).toBeInTheDocument();
    expect(within(summary).getByText('Rs 8,787.50')).toBeInTheDocument();
    expect(within(summary).getByText('Rs 1,623.35')).toHaveClass('negative');
  });

  it('shows no liabilities styling when nothing is owed', async () => {
    accountsApi.list.mockResolvedValue([accounts[0]]);
    render(<Accounts />);
    await screen.findByText('Main Checking');
    const summary = screen.getByText('Net worth').closest('section');
    expect(within(summary).getByText('Rs 0.00')).not.toHaveClass('negative');
  });

  it('picks an icon by account type', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    for (const name of ['Main Checking', 'Visa Card', 'Empty']) {
      expect(cardFor(name).querySelector('.tile svg')).not.toBeNull();
    }
  });

  it('shows an empty state with no accounts', async () => {
    accountsApi.list.mockResolvedValue([]);
    render(<Accounts />);
    expect(await screen.findByText(/No accounts yet/)).toBeInTheDocument();
    expect(screen.queryByText('Net worth')).not.toBeInTheDocument();
  });

  it('asks for confirmation naming the transactions, then cascades the delete', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(within(cardFor('Main Checking')).getByRole('button', { name: 'Delete Main Checking' }));

    expect(within(dialog()).getByRole('heading', { name: 'Delete account' })).toBeInTheDocument();
    expect(within(dialog()).getByText(/its 15 transactions\?/)).toBeInTheDocument();
    expect(accountsApi.remove).not.toHaveBeenCalled();

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(accountsApi.remove).toHaveBeenCalledWith(1, { cascade: true }));
    await waitFor(() => expect(accountsApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('never relies on the browser confirm() pop-up', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Accounts />);
    await screen.findByText('Empty');
    await userEvent.click(within(cardFor('Empty')).getByRole('button', { name: 'Delete Empty' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(accountsApi.remove).toHaveBeenCalledWith(3, { cascade: false }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('uses a singular noun for one transaction and plain wording when there are none', async () => {
    accountsApi.list.mockResolvedValue([
      { ...accounts[0], id: 7, name: 'One', transactionCount: 1 },
      accounts[2],
    ]);
    render(<Accounts />);
    await screen.findByText('One');
    await userEvent.click(within(cardFor('One')).getByRole('button', { name: 'Delete One' }));
    expect(within(dialog()).getByText(/its 1 transaction\?/)).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(within(cardFor('Empty')).getByRole('button', { name: 'Delete Empty' }));
    expect(within(dialog()).getByText('Delete "Empty"? This cannot be undone.')).toBeInTheDocument();
  });

  it('does nothing when the deletion is cancelled', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(within(cardFor('Main Checking')).getByRole('button', { name: 'Delete Main Checking' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(dialog()).toBeNull();
    expect(accountsApi.remove).not.toHaveBeenCalled();
  });

  it('shows the error inside the dialog when a delete fails and keeps it open', async () => {
    accountsApi.remove.mockRejectedValue(new Error('Account has transactions'));
    render(<Accounts />);
    await screen.findByText('Empty');
    await userEvent.click(within(cardFor('Empty')).getByRole('button', { name: 'Delete Empty' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Account has transactions');
    expect(within(dialog()).getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('opens the add form in a dialog and closes it on cancel', async () => {
    render(<Accounts />);
    await screen.findByText('Main Checking');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(within(dialog()).getByRole('heading', { name: 'Add account' })).toBeInTheDocument();

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(dialog()).toBeNull();
  });

  it('opens the edit form prefilled for the chosen account', async () => {
    render(<Accounts />);
    await screen.findByText('Visa Card');
    await userEvent.click(within(cardFor('Visa Card')).getByRole('button', { name: 'Edit Visa Card' }));
    expect(within(dialog()).getByRole('heading', { name: 'Edit account' })).toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Name')).toHaveValue('Visa Card');
    expect(within(dialog()).getByLabelText('Type')).toHaveValue('Credit Card');
  });

  it('reloads the list and confirms with a toast after saving a new account', async () => {
    accountsApi.create.mockResolvedValue({});
    render(
      <ToastProvider>
        <Accounts />
      </ToastProvider>,
    );
    await screen.findByText('Main Checking');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    await userEvent.type(within(dialog()).getByLabelText('Name'), 'Savings');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Add account' }));

    await waitFor(() => expect(accountsApi.create).toHaveBeenCalled());
    await waitFor(() => expect(accountsApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(await screen.findByText('Account added')).toBeInTheDocument();
  });

  it('confirms a deletion with a toast', async () => {
    render(
      <ToastProvider>
        <Accounts />
      </ToastProvider>,
    );
    await screen.findByText('Empty');
    await userEvent.click(within(cardFor('Empty')).getByRole('button', { name: 'Delete Empty' }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Empty deleted')).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    accountsApi.list.mockRejectedValue(new Error('Cannot reach the server'));
    render(<Accounts />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
