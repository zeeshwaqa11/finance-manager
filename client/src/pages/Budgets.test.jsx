import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetsApi, categoriesApi, reportsApi } from '../api/index.js';
import { ToastProvider } from '../components/Toast.jsx';
import { addMonths, currentMonth } from '../utils/format.js';
import Budgets from './Budgets.jsx';

vi.mock('../api/index.js', () => ({
  budgetsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  categoriesApi: { list: vi.fn() },
  reportsApi: { summary: vi.fn() },
}));

const month = currentMonth();
const categories = [
  { id: 1, name: 'Food', kind: 'expense' },
  { id: 2, name: 'Salary', kind: 'income' },
  { id: 3, name: 'Rent', kind: 'expense' },
];
const foodBudget = { id: 10, categoryId: 1, categoryName: 'Food', month, amount: 300 };

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function renderPage() {
  render(<Budgets />);
  await screen.findByLabelText('Food budget');
}

beforeEach(() => {
  vi.clearAllMocks();
  categoriesApi.list.mockResolvedValue(categories);
  budgetsApi.list.mockImplementation(async (m) => (m === month ? [foodBudget] : []));
  reportsApi.summary.mockResolvedValue({ spendingByCategory: [{ categoryId: 1, categoryName: 'Food', spent: 120 }] });
  budgetsApi.create.mockResolvedValue({});
  budgetsApi.update.mockResolvedValue({});
  budgetsApi.remove.mockResolvedValue(null);
});

describe('Budgets page: summary and progress', () => {
  it('summarises the total budgeted and how much of it is used', async () => {
    await renderPage();
    expect(screen.getByText('Total budgeted')).toBeInTheDocument();
    expect(screen.getByText('Rs 300.00')).toBeInTheDocument();
    expect(screen.getByText('Rs 120.00 of Rs 300.00')).toBeInTheDocument();
    expect(screen.getByText('40% used')).toBeInTheDocument();
  });

  it('hides the summary when no budgets are set', async () => {
    budgetsApi.list.mockResolvedValue([]);
    render(<Budgets />);
    await screen.findByLabelText('Food budget');
    expect(screen.queryByText('Total budgeted')).not.toBeInTheDocument();
  });

  it('draws a progress bar only for categories that have a budget', async () => {
    await renderPage();
    const bar = screen.getByRole('progressbar', { name: 'Food budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar.firstChild).toHaveClass('under');
    expect(screen.queryByRole('progressbar', { name: 'Rent budget used' })).not.toBeInTheDocument();
  });

  it('flags an overspent category and caps the bar at 100%', async () => {
    reportsApi.summary.mockResolvedValue({ spendingByCategory: [{ categoryId: 1, categoryName: 'Food', spent: 450 }] });
    await renderPage();
    const bar = screen.getByRole('progressbar', { name: 'Food budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar.firstChild).toHaveClass('over');
    expect(bar.firstChild).toHaveStyle({ width: '100%' });
  });

  it('colours each category with a dot', async () => {
    await renderPage();
    expect(screen.getByLabelText('Food budget').closest('li').querySelector('.dot')).not.toBeNull();
  });

  it('confirms a save with a toast', async () => {
    render(
      <ToastProvider>
        <Budgets />
      </ToastProvider>,
    );
    await screen.findByLabelText('Food budget');
    await userEvent.type(screen.getByLabelText('Rent budget'), '900');
    await userEvent.click(screen.getByLabelText('Rent budget').closest('li').querySelector('button.btn-secondary'));
    expect(await screen.findByText('Rent budget saved')).toBeInTheDocument();
  });

  it('confirms a removal with a toast', async () => {
    render(
      <ToastProvider>
        <Budgets />
      </ToastProvider>,
    );
    await screen.findByLabelText('Food budget');
    await userEvent.click(screen.getByLabelText('Food budget').closest('li').querySelector('button.btn-danger'));
    expect(await screen.findByText('Food budget removed')).toBeInTheDocument();
  });
});

describe('Budgets page', () => {
  it('lists expense categories only, with spending and any existing budget', async () => {
    await renderPage();
    expect(screen.getByLabelText('Rent budget')).toHaveValue(null);
    expect(screen.queryByLabelText('Salary budget')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Food budget')).toHaveValue(300);
    expect(screen.getByText('Rs 120.00')).toBeInTheDocument();
  });

  it('creates a budget for a category that has none', async () => {
    await renderPage();
    await userEvent.type(screen.getByLabelText('Rent budget'), '900');
    const row = screen.getByLabelText('Rent budget').closest('li');
    await userEvent.click(row.querySelector('button.btn-secondary'));
    await waitFor(() => expect(budgetsApi.create).toHaveBeenCalled());
    expect(budgetsApi.create).toHaveBeenCalledWith({ categoryId: 3, month, amount: 900 });
    expect(budgetsApi.update).not.toHaveBeenCalled();
  });

  it('updates an existing budget by id', async () => {
    await renderPage();
    const input = screen.getByLabelText('Food budget');
    await userEvent.clear(input);
    await userEvent.type(input, '350');
    await userEvent.click(input.closest('li').querySelector('button.btn-secondary'));
    await waitFor(() => expect(budgetsApi.update).toHaveBeenCalledWith(10, 350));
    expect(budgetsApi.create).not.toHaveBeenCalled();
  });

  it('only enables Save for a changed, positive amount', async () => {
    await renderPage();
    const input = screen.getByLabelText('Food budget');
    const save = input.closest('li').querySelector('button.btn-secondary');
    expect(save).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(save).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '10');
    expect(save).toBeEnabled();
  });

  it('removes a budget, and disables Remove where none exists', async () => {
    await renderPage();
    const rentRow = screen.getByLabelText('Rent budget').closest('li');
    expect(rentRow.querySelector('button.btn-danger')).toBeDisabled();

    const foodRow = screen.getByLabelText('Food budget').closest('li');
    await userEvent.click(foodRow.querySelector('button.btn-danger'));
    await waitFor(() => expect(budgetsApi.remove).toHaveBeenCalledWith(10));
  });

  it('shows an API error when saving fails', async () => {
    budgetsApi.create.mockRejectedValue(new Error('Budgets can only be set for expense categories'));
    await renderPage();
    await userEvent.type(screen.getByLabelText('Rent budget'), '50');
    await userEvent.click(screen.getByLabelText('Rent budget').closest('li').querySelector('button.btn-secondary'));
    expect(await screen.findByRole('alert')).toHaveTextContent('expense categories');
  });

  it('does not show or allow editing the previous month budgets while a new month loads', async () => {
    await renderPage();
    const next = deferred();
    budgetsApi.list.mockImplementation((m) => (m === addMonths(month, 1) ? next.promise : Promise.resolve([foodBudget])));

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.queryByLabelText('Food budget')).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    next.resolve([]);
    const input = await screen.findByLabelText('Food budget');
    expect(input).toHaveValue(null);
  });

  it('copies only the missing budgets from the previous month', async () => {
    const previous = [
      { id: 1, categoryId: 1, categoryName: 'Food', amount: 250 },
      { id: 2, categoryId: 3, categoryName: 'Rent', amount: 1000 },
    ];
    budgetsApi.list.mockImplementation(async (m) => {
      if (m === month) return [foodBudget];
      if (m === addMonths(month, -1)) return previous;
      return [];
    });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Copy budgets from/ }));
    await waitFor(() => expect(budgetsApi.create).toHaveBeenCalledTimes(1));
    expect(budgetsApi.create).toHaveBeenCalledWith({ categoryId: 3, month, amount: 1000 });
  });

  it('tells the user when there is nothing to copy, as information rather than an error', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Copy budgets from/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('Nothing to copy');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(budgetsApi.create).not.toHaveBeenCalled();
  });

  it('shows a load error with a retry option', async () => {
    categoriesApi.list.mockRejectedValue(new Error('Cannot reach the server'));
    render(<Budgets />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
