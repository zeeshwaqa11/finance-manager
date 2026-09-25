import { db } from '../db/connection.js';
import { badRequest, notFound } from '../middleware/validate.js';
import { fromCents } from '../utils/money.js';

const SELECT_TRANSACTIONS = `
  SELECT t.id, t.account_id AS accountId, a.name AS accountName,
         t.category_id AS categoryId, c.name AS categoryName,
         t.amount_cents AS amountCents, t.type, t.date, t.note, t.created_at AS createdAt
  FROM transactions t
  JOIN accounts a   ON a.id = t.account_id
  JOIN categories c ON c.id = t.category_id
`;

const SORT_COLUMNS = {
  date: 't.date',
  amount: 't.amount_cents',
  category: 'c.name',
  account: 'a.name',
  type: 't.type',
};

const toApi = ({ amountCents, ...rest }) => ({ ...rest, amount: fromCents(amountCents) });

export function listTransactions({ accountId, categoryId, type, from, to, sort = 'date', order = 'desc' } = {}) {
  const where = [];
  const params = [];
  if (accountId) { where.push('t.account_id = ?'); params.push(accountId); }
  if (categoryId) { where.push('t.category_id = ?'); params.push(categoryId); }
  if (type) { where.push('t.type = ?'); params.push(type); }
  if (from) { where.push('t.date >= ?'); params.push(from); }
  if (to) { where.push('t.date <= ?'); params.push(to); }

  const column = SORT_COLUMNS[sort];
  if (!column) throw badRequest(`sort must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}`);
  const direction = order === 'asc' ? 'ASC' : 'DESC';

  const sql = `
    ${SELECT_TRANSACTIONS}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${column} ${direction}, t.id DESC`;
  return db.prepare(sql).all(...params).map(toApi);
}

export function getTransaction(id) {
  const row = db.prepare(`${SELECT_TRANSACTIONS} WHERE t.id = ?`).get(id);
  if (!row) throw notFound('Transaction');
  return toApi(row);
}

function assertReferencesExist(accountId, categoryId) {
  if (!db.prepare('SELECT 1 FROM accounts WHERE id = ?').get(accountId)) throw badRequest('accountId does not exist');
  if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) throw badRequest('categoryId does not exist');
}

export function createTransaction({ accountId, categoryId, amountCents, type, date, note }) {
  assertReferencesExist(accountId, categoryId);
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (account_id, category_id, amount_cents, type, date, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(accountId, categoryId, amountCents, type, date, note);
  return getTransaction(lastInsertRowid);
}

export function updateTransaction(id, { accountId, categoryId, amountCents, type, date, note }) {
  getTransaction(id);
  assertReferencesExist(accountId, categoryId);
  db.prepare(
    `UPDATE transactions
     SET account_id = ?, category_id = ?, amount_cents = ?, type = ?, date = ?, note = ?
     WHERE id = ?`,
  ).run(accountId, categoryId, amountCents, type, date, note, id);
  return getTransaction(id);
}

export function deleteTransaction(id) {
  const { changes } = db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  if (!changes) throw notFound('Transaction');
}
