import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsApi } from '../api/index.js';
import AccountForm from './AccountForm.jsx';

vi.mock('../api/index.js', () => ({
  accountsApi: { create: vi.fn(), update: vi.fn() },
}));

function renderForm(props = {}) {
  const handlers = { onSaved: vi.fn(), onCancel: vi.fn() };
  render(<AccountForm {...handlers} {...props} />);
  return handlers;
}

beforeEach(() => {
  vi.clearAllMocks();
  accountsApi.create.mockResolvedValue({});
  accountsApi.update.mockResolvedValue({});
});

describe('AccountForm', () => {
  it('starts with a Bank type and a zero opening balance', () => {
    renderForm();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Type')).toHaveValue('Bank');
    expect(screen.getByLabelText(/Opening balance/)).toHaveValue(0);
  });

  it('suggests the common types but accepts custom ones', async () => {
    renderForm();
    const options = [...document.querySelectorAll('#account-types option')].map((o) => o.value);
    expect(options).toEqual(['Cash', 'Bank', 'Credit Card']);

    const type = screen.getByLabelText('Type');
    await userEvent.clear(type);
    await userEvent.type(type, 'Brokerage');
    await userEvent.type(screen.getByLabelText('Name'), 'Stocks');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    await waitFor(() => expect(accountsApi.create).toHaveBeenCalled());
    expect(accountsApi.create).toHaveBeenCalledWith({ name: 'Stocks', type: 'Brokerage', openingBalance: 0 });
  });

  it('sends the opening balance as a number, allowing negatives', async () => {
    const { onSaved } = renderForm();
    await userEvent.type(screen.getByLabelText('Name'), 'Card');
    const balance = screen.getByLabelText(/Opening balance/);
    await userEvent.clear(balance);
    await userEvent.type(balance, '-250.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(accountsApi.create).toHaveBeenCalledWith({ name: 'Card', type: 'Bank', openingBalance: -250.5 });
  });

  it('requires a name', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(accountsApi.create).not.toHaveBeenCalled();
  });

  it('shows a server error such as a duplicate name', async () => {
    accountsApi.create.mockRejectedValue(new Error('An account named "Wallet" already exists'));
    const { onSaved } = renderForm();
    await userEvent.type(screen.getByLabelText('Name'), 'Wallet');
    await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('prefills and updates an existing account by id', async () => {
    const account = { id: 4, name: 'Wallet', type: 'Cash', openingBalance: 50 };
    const { onSaved } = renderForm({ account });
    expect(screen.getByLabelText('Name')).toHaveValue('Wallet');
    expect(screen.getByLabelText(/Opening balance/)).toHaveValue(50);

    await userEvent.type(screen.getByLabelText('Name'), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(accountsApi.update).toHaveBeenCalledWith(4, { name: 'Wallet 2', type: 'Cash', openingBalance: 50 });
  });
});
