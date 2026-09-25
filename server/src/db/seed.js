import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMonths, currentMonth, todayISO } from '../utils/dates.js';
import { toCents } from '../utils/money.js';

const ACCOUNTS = [
  ['Wallet', 'Cash', 70000],
  ['Bank Account', 'Bank', 250000],
  ['Credit Card', 'Credit Card', 0],
];

const MONTH_TEMPLATE = [
  [1, 'Bank Account', 'Salary', 'income', 185000, 'Monthly salary', false],
  [1, 'Bank Account', 'Rent', 'expense', 55000, 'House rent', false],
  [2, 'Credit Card', 'Food', 'expense', 5200, 'Weekly groceries', true],
  [3, 'Wallet', 'Transport', 'expense', 3500, 'Petrol', true],
  [5, 'Bank Account', 'Utilities', 'expense', 14500, 'Electricity bill', false],
  [6, 'Wallet', 'Food', 'expense', 3100, 'Lunch out', true],
  [8, 'Credit Card', 'Entertainment', 'expense', 1500, 'Streaming subscription', false],
  [9, 'Credit Card', 'Food', 'expense', 6800, 'Groceries', true],
  [10, 'Wallet', 'Transport', 'expense', 1800, 'Ride-hailing', true],
  [12, 'Bank Account', 'Utilities', 'expense', 4500, 'Internet bill', false],
  [13, 'Wallet', 'Food', 'expense', 2900, 'Dinner takeaway', true],
  [14, 'Credit Card', 'Entertainment', 'expense', 3500, 'Cinema and dinner', true],
  [15, 'Bank Account', 'Other', 'income', 22000, 'Freelance project', false],
  [17, 'Credit Card', 'Food', 'expense', 7400, 'Groceries', true],
  [18, 'Wallet', 'Transport', 'expense', 4000, 'Petrol', true],
  [19, 'Credit Card', 'Health', 'expense', 2400, 'Pharmacy', true],
  [20, 'Credit Card', 'Shopping', 'expense', 6500, 'New shoes', true],
  [21, 'Credit Card', 'Food', 'expense', 4300, 'Groceries', true],
  [22, 'Credit Card', 'Entertainment', 'expense', 5000, 'Concert ticket', true],
  [25, 'Wallet', 'Food', 'expense', 5600, 'Sabzi mandi', true],
  [28, 'Credit Card', 'Food', 'expense', 4800, 'Groceries', true],
];

const BUDGETS = { Food: 32000, Transport: 9000, Entertainment: 12000, Utilities: 20000 };

const MONTH_FACTORS = [0.7, 1.0, 1.15];

export function seedSampleData(db) {
  const categoryId = Object.fromEntries(db.prepare('SELECT name, id FROM categories').all().map((c) => [c.name, c.id]));
  const insertAccount = db.prepare('INSERT INTO accounts (name, type, opening_balance_cents) VALUES (?, ?, ?)');
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (account_id, category_id, amount_cents, type, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertBudget = db.prepare('INSERT INTO budgets (category_id, month, amount_cents) VALUES (?, ?, ?)');

  db.transaction(() => {
    const accountId = {};
    for (const [name, type, opening] of ACCOUNTS) {
      accountId[name] = insertAccount.run(name, type, toCents(opening)).lastInsertRowid;
    }

    const thisMonth = currentMonth();
    const today = todayISO();
    MONTH_FACTORS.forEach((factor, i) => {
      const month = addMonths(thisMonth, i - 2);
      for (const [day, account, category, type, amount, note, scales] of MONTH_TEMPLATE) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        if (date > today) continue;
        const cents = toCents(scales ? amount * factor : amount);
        insertTransaction.run(accountId[account], categoryId[category], cents, type, date, note);
      }
      for (const [category, amount] of Object.entries(BUDGETS)) {
        insertBudget.run(categoryId[category], month, toCents(amount));
      }
    });
  })();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { db } = await import('./connection.js');
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM accounts').get();
  if (n > 0) {
    console.log('Database already has accounts; not seeding. Run `npm run reset` for a fresh start.');
  } else {
    seedSampleData(db);
    console.log('Sample data added.');
  }
}
