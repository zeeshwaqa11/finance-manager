import { db } from '../db/connection.js';
import { conflict, notFound } from '../middleware/validate.js';
import { fromCents } from '../utils/money.js';

const SELECT_ACCOUNTS = `
  SELECT a.id, a.name, a.type, a.created_at AS createdAt,
         a.opening_balance_cents AS openingCents,
         a.opening_balance_cents
           + COALESCE(SUM(CASE t.type WHEN 'income' THEN t.amount_cents ELSE -t.amount_cents END), 0)
           AS balanceCents,
         COUNT(t.id) AS transactionCount
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id
`;

const toApi = ({ openingCents, balanceCents, ...rest }) => ({
  ...rest,
  openingBalance: fromCents(openingCents),
  balance: fromCents(balanceCents),
});

export function listAccounts() {
  return db.prepare(`${SELECT_ACCOUNTS} GROUP BY a.id ORDER BY a.name`).all().map(toApi);
}

export function getAccount(id) {
  const row = db.prepare(`${SELECT_ACCOUNTS} WHERE a.id = ? GROUP BY a.id`).get(id);
  if (!row) throw notFound('Account');
  return toApi(row);
}

export function createAccount({ name, type, openingBalanceCents }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO accounts (name, type, opening_balance_cents) VALUES (?, ?, ?)')
    .run(name, type, openingBalanceCents);
  return getAccount(lastInsertRowid);
}

export function updateAccount(id, { name, type, openingBalanceCents }) {
  const { changes } = db
    .prepare('UPDATE accounts SET name = ?, type = ?, opening_balance_cents = ? WHERE id = ?')
    .run(name, type, openingBalanceCents, id);
  if (!changes) throw notFound('Account');
  return getAccount(id);
}

export function deleteAccount(id, { cascade = false } = {}) {
  const account = getAccount(id);
  if (account.transactionCount > 0 && !cascade) {
    throw conflict(
      `Account has ${account.transactionCount} transaction(s). Delete them first or retry with ?cascade=true`,
    );
  }
  db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE account_id = ?').run(id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  })();
}
