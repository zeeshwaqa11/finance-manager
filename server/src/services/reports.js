import { db } from '../db/connection.js';
import { addMonths, monthBounds } from '../utils/dates.js';
import { fromCents } from '../utils/money.js';

export function monthlySummary(month) {
  const { start, end } = monthBounds(month);

  const totals = { income: 0, expense: 0 };
  const totalRows = db
    .prepare('SELECT type, SUM(amount_cents) AS cents FROM transactions WHERE date BETWEEN ? AND ? GROUP BY type')
    .all(start, end);
  for (const row of totalRows) totals[row.type] = row.cents;

  const spendingRows = db
    .prepare(
      `SELECT c.id AS categoryId, c.name AS categoryName, SUM(t.amount_cents) AS cents
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.type = 'expense' AND t.date BETWEEN ? AND ?
       GROUP BY c.id ORDER BY cents DESC`,
    )
    .all(start, end);
  const spentByCategory = new Map(spendingRows.map((r) => [r.categoryId, r.cents]));

  const budgetRows = db
    .prepare(
      `SELECT b.category_id AS categoryId, c.name AS categoryName, b.amount_cents AS budgetCents
       FROM budgets b JOIN categories c ON c.id = b.category_id
       WHERE b.month = ? ORDER BY c.name`,
    )
    .all(month);

  const budgets = budgetRows.map(({ categoryId, categoryName, budgetCents }) => {
    const spentCents = spentByCategory.get(categoryId) ?? 0;
    return {
      categoryId,
      categoryName,
      budget: fromCents(budgetCents),
      spent: fromCents(spentCents),
      remaining: fromCents(budgetCents - spentCents),
      percentUsed: Math.round((spentCents / budgetCents) * 1000) / 10,
      status: spentCents > budgetCents ? 'over' : 'under',
    };
  });

  return {
    month,
    totalIncome: fromCents(totals.income),
    totalExpenses: fromCents(totals.expense),
    net: fromCents(totals.income - totals.expense),
    spendingByCategory: spendingRows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      spent: fromCents(r.cents),
    })),
    budgets,
  };
}

export function spendingTrend(endMonth, months) {
  const firstMonth = addMonths(endMonth, -(months - 1));
  const rows = db
    .prepare(
      `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS cents
       FROM transactions
       WHERE type = 'expense' AND date BETWEEN ? AND ?
       GROUP BY month`,
    )
    .all(monthBounds(firstMonth).start, monthBounds(endMonth).end);
  const byMonth = new Map(rows.map((r) => [r.month, r.cents]));

  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(firstMonth, i);
    return { month, totalExpenses: fromCents(byMonth.get(month) ?? 0) };
  });
}
