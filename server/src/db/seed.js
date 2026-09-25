import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addMonths, currentMonth, todayISO } from '../utils/dates.js';
import { toCents } from '../utils/money.js';

const ACCOUNTS = [
  ['Wallet', 'Cash', 900],
  ['Main Checking', 'Bank', 2500],
  ['Visa Card', 'Credit Card', 0],
];

const MONTH_TEMPLATE = [
  [1, 'Main Checking', 'Salary', 'income', 3200, 'Monthly paycheck', false],
  [1, 'Main Checking', 'Rent', 'expense', 1200, 'Apartment rent', false],
  [2, 'Visa Card', 'Food', 'expense', 68.45, 'Weekly groceries', true],
  [3, 'Wallet', 'Transport', 'expense', 45, 'Fuel', true],
  [5, 'Main Checking', 'Utilities', 'expense', 95.4, 'Electricity bill', false],
  [6, 'Wallet', 'Food', 'expense', 42.1, 'Lunch out', true],
  [8, 'Visa Card', 'Entertainment', 'expense', 15.99, 'Streaming subscription', false],
  [9, 'Visa Card', 'Food', 'expense', 85.3, 'Groceries', true],
  [10, 'Wallet', 'Transport', 'expense', 22.5, 'Bus pass top-up', true],
  [12, 'Main Checking', 'Utilities', 'expense', 62.1, 'Internet', false],
  [13, 'Wallet', 'Food', 'expense', 37.8, 'Takeaway dinner', true],
  [14, 'Visa Card', 'Entertainment', 'expense', 42, 'Cinema and dinner', true],
  [15, 'Main Checking', 'Other', 'income', 250, 'Freelance gig', false],
  [17, 'Visa Card', 'Food', 'expense', 96.25, 'Groceries', true],
  [18, 'Wallet', 'Transport', 'expense', 48, 'Fuel', true],
  [19, 'Visa Card', 'Health', 'expense', 28.5, 'Pharmacy', true],
  [20, 'Visa Card', 'Shopping', 'expense', 79.99, 'New shoes', true],
  [21, 'Visa Card', 'Food', 'expense', 54.6, 'Groceries', true],
  [22, 'Visa Card', 'Entertainment', 'expense', 60, 'Concert ticket', true],
  [25, 'Wallet', 'Food', 'expense', 71.9, 'Farmers market', true],
  [28, 'Visa Card', 'Food', 'expense', 63.15, 'Groceries', true],
];

const BUDGETS = { Food: 400, Transport: 120, Entertainment: 150, Utilities: 170 };

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
