import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.DB_PATH = ':memory:';

const { applySchema, openDatabase } = await import('../src/db/connection.js');
const { seedSampleData } = await import('../src/db/seed.js');
const { addMonths, currentMonth, todayISO } = await import('../src/utils/dates.js');

const fresh = () => openDatabase(':memory:').db;

describe('schema', () => {
  it('creates tables and starter categories on a new database', () => {
    const { db, created } = openDatabase(':memory:');
    assert.equal(created, true);
    const names = db.prepare('SELECT name FROM categories ORDER BY name').all().map((c) => c.name);
    assert.deepEqual(names, ['Entertainment', 'Food', 'Health', 'Other', 'Rent', 'Salary', 'Shopping', 'Transport', 'Utilities']);
    assert.equal(db.pragma('user_version', { simple: true }), 1);
  });

  it('is idempotent: applying it again changes nothing', () => {
    const db = fresh();
    db.prepare("DELETE FROM categories WHERE name = 'Other'").run();
    assert.equal(applySchema(db), false);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM categories').get().n, 8);
  });

  it('enforces foreign keys', () => {
    const db = fresh();
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.throws(() =>
      db.prepare("INSERT INTO transactions (account_id, category_id, amount_cents, type, date) VALUES (99, 1, 100, 'expense', '2026-01-01')").run(),
    );
  });

  it('rejects invalid rows through CHECK constraints', () => {
    const db = fresh();
    db.prepare("INSERT INTO accounts (name, type) VALUES ('A', 'Cash')").run();
    const insert = (amount, type, date) =>
      db.prepare('INSERT INTO transactions (account_id, category_id, amount_cents, type, date) VALUES (1, 1, ?, ?, ?)').run(amount, type, date);
    assert.throws(() => insert(0, 'expense', '2026-01-01'));
    assert.throws(() => insert(-5, 'expense', '2026-01-01'));
    assert.throws(() => insert(100, 'refund', '2026-01-01'));
    assert.throws(() => insert(100, 'expense', '01/01/2026'));
    assert.doesNotThrow(() => insert(100, 'expense', '2026-01-01'));
  });

  it('keeps one budget per category and month', () => {
    const db = fresh();
    const insert = () => db.prepare("INSERT INTO budgets (category_id, month, amount_cents) VALUES (1, '2026-01', 1000)").run();
    insert();
    assert.throws(insert);
  });

  it('treats names as unique regardless of case', () => {
    const db = fresh();
    assert.throws(() => db.prepare("INSERT INTO categories (name) VALUES ('FOOD')").run());
    db.prepare("INSERT INTO accounts (name, type) VALUES ('Wallet', 'Cash')").run();
    assert.throws(() => db.prepare("INSERT INTO accounts (name, type) VALUES ('wallet', 'Cash')").run());
  });

  it('refuses to delete an account that has transactions, and cascades budgets with a category', () => {
    const db = fresh();
    db.prepare("INSERT INTO accounts (name, type) VALUES ('A', 'Cash')").run();
    db.prepare("INSERT INTO transactions (account_id, category_id, amount_cents, type, date) VALUES (1, 1, 100, 'expense', '2026-01-01')").run();
    assert.throws(() => db.prepare('DELETE FROM accounts WHERE id = 1').run());

    db.prepare("INSERT INTO budgets (category_id, month, amount_cents) VALUES (2, '2026-01', 500)").run();
    db.prepare('DELETE FROM categories WHERE id = 2').run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM budgets').get().n, 0);
  });
});

describe('seedSampleData', () => {
  const db = fresh();
  seedSampleData(db);
  const count = (sql) => db.prepare(sql).get().n;

  it('creates accounts, transactions and budgets', () => {
    assert.equal(count('SELECT COUNT(*) AS n FROM accounts'), 3);
    assert.ok(count('SELECT COUNT(*) AS n FROM transactions') > 30);
    assert.equal(count('SELECT COUNT(*) AS n FROM budgets'), 12);
  });

  it('covers the current month and the two before it', () => {
    const months = db.prepare('SELECT DISTINCT substr(date, 1, 7) AS m FROM transactions ORDER BY m').all().map((r) => r.m);
    const now = currentMonth();
    assert.deepEqual(months, [addMonths(now, -2), addMonths(now, -1), now]);
  });

  it('never creates future-dated transactions', () => {
    assert.equal(count(`SELECT COUNT(*) AS n FROM transactions WHERE date > '${todayISO()}'`), 0);
  });

  it('gives every account a sensible non-negative balance except the credit card', () => {
    const rows = db
      .prepare(
        `SELECT a.name, a.type,
                a.opening_balance_cents + COALESCE(SUM(CASE t.type WHEN 'income' THEN t.amount_cents ELSE -t.amount_cents END), 0) AS balance
         FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id GROUP BY a.id`,
      )
      .all();
    for (const row of rows) {
      if (row.type !== 'Credit Card') assert.ok(row.balance >= 0, `${row.name} is negative`);
    }
  });

  it('only budgets expense categories', () => {
    assert.equal(
      count("SELECT COUNT(*) AS n FROM budgets b JOIN categories c ON c.id = b.category_id WHERE c.kind = 'income'"),
      0,
    );
  });
});
