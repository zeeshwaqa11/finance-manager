import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoriesApi, reportsApi } from '../api/index.js';
import { addMonths, currentMonth } from '../utils/format.js';
import Dashboard from './Dashboard.jsx';

vi.mock('../api/index.js', () => ({
  categoriesApi: { list: vi.fn() },
  reportsApi: { summary: vi.fn(), trend: vi.fn() },
}));

vi.mock('../components/charts.jsx', () => ({
  SpendingDoughnut: ({ items }) => <div data-testid="doughnut">{items.map((i) => i.name).join(',')}</div>,
  TrendBars: ({ trend, selectedMonth }) => (
    <div data-testid="trend">{`${trend.length} bars, selected ${selectedMonth}`}</div>
  ),
}));

const month = currentMonth();

const summary = {
  month,
  totalIncome: 3450,
  totalExpenses: 2273.25,
  net: 1176.75,
  spendingByCategory: [
    { categoryId: 1, categoryName: 'Rent', spent: 1200 },
    { categoryId: 2, categoryName: 'Food', spent: 524.87 },
  ],
  budgets: [
    { categoryId: 2, categoryName: 'Food', budget: 400, spent: 524.87, remaining: -124.87, percentUsed: 131.2, status: 'over' },
    { categoryId: 3, categoryName: 'Transport', budget: 120, spent: 100, remaining: 20, percentUsed: 83.3, status: 'under' },
  ],
};

const trend = Array.from({ length: 6 }, (_, i) => ({ month: addMonths(month, i - 5), totalExpenses: 100 * i }));

beforeEach(() => {
  vi.clearAllMocks();
  categoriesApi.list.mockResolvedValue([
    { id: 1, name: 'Rent', kind: 'expense' },
    { id: 2, name: 'Food', kind: 'expense' },
    { id: 3, name: 'Transport', kind: 'expense' },
  ]);
  reportsApi.summary.mockResolvedValue(summary);
  reportsApi.trend.mockResolvedValue(trend);
});

describe('Dashboard', () => {
  it('shows a loading message before data arrives', () => {
    reportsApi.summary.mockReturnValue(new Promise(() => {}));
    render(<Dashboard />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows income, expenses and a signed net for the month', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('$3,450.00')).toBeInTheDocument();
    expect(screen.getByText('$2,273.25')).toBeInTheDocument();
    expect(screen.getByText('+$1,176.75')).toBeInTheDocument();
  });

  it('shows a negative net without a plus sign', async () => {
    reportsApi.summary.mockResolvedValue({ ...summary, totalIncome: 100, totalExpenses: 300, net: -200 });
    render(<Dashboard />);
    const net = await screen.findByText('-$200.00');
    expect(net).toHaveClass('negative');
  });

  it('does not colour or sign a zero net', async () => {
    reportsApi.summary.mockResolvedValue({ ...summary, totalIncome: 0, totalExpenses: 0, net: 0, spendingByCategory: [], budgets: [] });
    render(<Dashboard />);
    await screen.findByText('No expenses in', { exact: false });
    const stats = [...document.querySelectorAll('.stat-value')];
    expect(stats.map((el) => el.textContent)).toEqual(['$0.00', '$0.00', '$0.00']);
    expect(stats[2]).not.toHaveClass('negative');
    expect(stats[2]).not.toHaveClass('income');
  });

  it('lists categories in the legend with their share of spending', async () => {
    render(<Dashboard />);
    const rent = (await screen.findAllByText('Rent')).find((el) => el.classList.contains('name'));
    const row = rent.closest('li');
    expect(within(row).getByText('$1,200.00')).toBeInTheDocument();
    expect(within(row).getByText('53%')).toBeInTheDocument();
    expect(screen.getByTestId('doughnut')).toHaveTextContent('Rent,Food');
  });

  it('flags over-budget and under-budget categories with words as well as colour', async () => {
    render(<Dashboard />);
    expect(await screen.findByText(/Over budget by \$124\.87 \(131\.2%\)/)).toHaveClass('over');
    expect(screen.getByText(/Under budget, \$20\.00 left \(83\.3%\)/)).toHaveClass('under');
    expect(screen.getByText('$524.87 of $400.00')).toBeInTheDocument();
  });

  it('caps the progress bar at 100% when over budget', async () => {
    render(<Dashboard />);
    const over = await screen.findByRole('progressbar', { name: 'Food budget used' });
    expect(over).toHaveAttribute('aria-valuenow', '100');
    expect(over.firstChild).toHaveStyle({ width: '100%' });
    const under = screen.getByRole('progressbar', { name: 'Transport budget used' });
    expect(under).toHaveAttribute('aria-valuenow', '83.3');
  });

  it('does not list categories without a budget in the budgets card', async () => {
    render(<Dashboard />);
    await screen.findByText('Budgets');
    expect(screen.queryByRole('progressbar', { name: 'Rent budget used' })).not.toBeInTheDocument();
  });

  it('shows empty states for a month with no spending or budgets', async () => {
    reportsApi.summary.mockResolvedValue({ ...summary, spendingByCategory: [], budgets: [] });
    render(<Dashboard />);
    expect(await screen.findByText(/No expenses in/)).toBeInTheDocument();
    expect(screen.getByText(/No budgets set for/)).toBeInTheDocument();
    expect(screen.queryByTestId('doughnut')).not.toBeInTheDocument();
  });

  it('renders the six-month trend and a table alternative', async () => {
    render(<Dashboard />);
    expect(await screen.findByTestId('trend')).toHaveTextContent(`6 bars, selected ${month}`);
    expect(reportsApi.trend).toHaveBeenCalledWith(month, 6);
    expect(screen.getByText('View as table')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(7);
  });

  it('reloads the reports when the month changes', async () => {
    render(<Dashboard />);
    await screen.findByText('$3,450.00');
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const previous = addMonths(month, -1);
    expect(reportsApi.summary).toHaveBeenLastCalledWith(previous);
    expect(reportsApi.trend).toHaveBeenLastCalledWith(previous, 6);
  });

  it('shows an error with a retry button when the server cannot be reached', async () => {
    reportsApi.summary.mockRejectedValue(new Error('Cannot reach the server'));
    render(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    reportsApi.summary.mockResolvedValue(summary);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('$3,450.00')).toBeInTheDocument();
  });
});
