import { db } from '../db/connection.js';
import { badRequest, conflict, notFound } from '../middleware/validate.js';
import { fromCents } from '../utils/money.js';

const SELECT_BUDGETS = `
  SELECT b.id, b.category_id AS categoryId, c.name AS categoryName, b.month, b.amount_cents AS amountCents
  FROM budgets b
  JOIN categories c ON c.id = b.category_id
`;

const toApi = ({ amountCents, ...rest }) => ({ ...rest, amount: fromCents(amountCents) });

export function listBudgets(month) {
  return db.prepare(`${SELECT_BUDGETS} WHERE b.month = ? ORDER BY c.name`).all(month).map(toApi);
}

export function getBudget(id) {
  const row = db.prepare(`${SELECT_BUDGETS} WHERE b.id = ?`).get(id);
  if (!row) throw notFound('Budget');
  return toApi(row);
}

export function createBudget({ categoryId, month, amountCents }) {
  const category = db.prepare('SELECT kind FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw badRequest('categoryId does not exist');
  if (category.kind === 'income') throw badRequest('Budgets can only be set for expense categories');

  const exists = db.prepare('SELECT 1 FROM budgets WHERE category_id = ? AND month = ?').get(categoryId, month);
  if (exists) throw conflict('A budget for this category and month already exists; update it instead');

  const { lastInsertRowid } = db
    .prepare('INSERT INTO budgets (category_id, month, amount_cents) VALUES (?, ?, ?)')
    .run(categoryId, month, amountCents);
  return getBudget(lastInsertRowid);
}

export function updateBudget(id, { amountCents }) {
  const { changes } = db.prepare('UPDATE budgets SET amount_cents = ? WHERE id = ?').run(amountCents, id);
  if (!changes) throw notFound('Budget');
  return getBudget(id);
}

export function deleteBudget(id) {
  const { changes } = db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
  if (!changes) throw notFound('Budget');
}
