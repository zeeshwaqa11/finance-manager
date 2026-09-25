import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionsApi } from '../api/index.js';
import { todayISO } from '../utils/format.js';
import TransactionForm from './TransactionForm.jsx';

vi.mock('../api/index.js', () => ({
  transactionsApi: { create: vi.fn(), update: vi.fn() },
}));

const accounts = [
  { id: 1, name: 'Wallet' },
  { id: 2, name: 'Bank' },
];
const categories = [
  { id: 1, name: 'Food', kind: 'expense' },
  { id: 2, name: 'Salary', kind: 'income' },
  { id: 3, name: 'Other', kind: 'both' },
];

const categoryOptions = () =>
  within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);

function renderForm(props = {}) {
  const handlers = { onSaved: vi.fn(), onCancel: vi.fn() };
  render(<TransactionForm accounts={accounts} categories={categories} {...handlers} {...props} />);
  return handlers;
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionsApi.create.mockResolvedValue({});
  transactionsApi.update.mockResolvedValue({});
});

describe('TransactionForm (new)', () => {
  it('starts as an expense dated today on the first account', () => {
    renderForm();
    expect(screen.getByRole('radio', { name: 'Expense' })).toBeChecked();
    expect(screen.getByLabelText('Date')).toHaveValue(todayISO());
    expect(screen.getByLabelText('Account')).toHaveValue('1');
    expect(screen.getByLabelText('Category')).toHaveValue('');
  });

  it('offers only expense and both categories for an expense', () => {
    renderForm();
    expect(categoryOptions()).toEqual(['Select…', 'Food', 'Other']);
  });

  it('switches the category list for income and clears an invalid selection', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Food');
    await userEvent.click(screen.getByRole('radio', { name: 'Income' }));
    expect(categoryOptions()).toEqual(['Select…', 'Salary', 'Other']);
    expect(screen.getByLabelText('Category')).toHaveValue('');
  });

  it('keeps a selected both-kind category when the type changes', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Other');
    await userEvent.click(screen.getByRole('radio', { name: 'Income' }));
    expect(screen.getByLabelText('Category')).toHaveValue('3');
  });

  it('submits numeric ids and amount to the API, then reports success', async () => {
    const { onSaved } = renderForm();
    await userEvent.type(screen.getByLabelText('Amount ($)'), '12.34');
    await userEvent.selectOptions(screen.getByLabelText('Account'), 'Bank');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Food');
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'lunch');
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(transactionsApi.create).toHaveBeenCalledWith({
      type: 'expense',
      amount: 12.34,
      accountId: 2,
      categoryId: 1,
      date: todayISO(),
      note: 'lunch',
    });
  });

  it('does not submit without a category', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Amount ($)'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('shows the server error and stays open', async () => {
    transactionsApi.create.mockRejectedValue(new Error('accountId does not exist'));
    const { onSaved } = renderForm();
    await userEvent.type(screen.getByLabelText('Amount ($)'), '5');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Food');
    await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('accountId does not exist');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeEnabled();
  });

  it('calls onCancel', async () => {
    const { onCancel } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('explains when there are no accounts yet', () => {
    renderForm({ accounts: [] });
    expect(screen.getByText(/at least one account/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount ($)')).not.toBeInTheDocument();
  });
});

describe('TransactionForm (edit)', () => {
  const existing = {
    id: 9,
    type: 'income',
    amount: 250,
    accountId: 2,
    categoryId: 2,
    date: '2026-03-04',
    note: 'bonus',
  };

  it('prefills every field', () => {
    renderForm({ transaction: existing });
    expect(screen.getByRole('radio', { name: 'Income' })).toBeChecked();
    expect(screen.getByLabelText('Amount ($)')).toHaveValue(250);
    expect(screen.getByLabelText('Account')).toHaveValue('2');
    expect(screen.getByLabelText('Category')).toHaveValue('2');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-03-04');
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('bonus');
  });

  it('updates by id', async () => {
    const { onSaved } = renderForm({ transaction: existing });
    const amount = screen.getByLabelText('Amount ($)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '300');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(transactionsApi.update).toHaveBeenCalledWith(9, expect.objectContaining({ amount: 300, categoryId: 2 }));
    expect(transactionsApi.create).not.toHaveBeenCalled();
  });

  it('keeps the transaction category selectable even if it does not match the type', () => {
    renderForm({ transaction: { ...existing, type: 'expense', categoryId: 2 } });
    expect(categoryOptions()).toContain('Salary');
    expect(screen.getByLabelText('Category')).toHaveValue('2');
  });
});
