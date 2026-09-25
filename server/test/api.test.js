import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.DB_PATH = ':memory:';

const { createApp } = await import('../src/app.js');
const { currentMonth } = await import('../src/utils/dates.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const categoryIdByName = async (name) => (await api('GET', '/categories')).body.find((c) => c.name === name).id;

describe('categories', () => {
  it('ships with the starter list', async () => {
    const { body } = await api('GET', '/categories');
    const names = body.map((c) => c.name);
    for (const expected of ['Food', 'Rent', 'Transport', 'Utilities', 'Entertainment', 'Salary', 'Other']) {
      assert.ok(names.includes(expected), `missing ${expected}`);
    }
  });

  it('rejects duplicate names (case-insensitive)', async () => {
    const { status } = await api('POST', '/categories', { name: 'food', kind: 'expense' });
    assert.equal(status, 409);
  });
});

describe('accounts and balances', () => {
  it('derives the balance from opening balance and transactions', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Test Bank', type: 'Bank', openingBalance: 100 })).body;
    assert.equal(acct.balance, 100);

    const food = await categoryIdByName('Food');
    const salary = await categoryIdByName('Salary');
    const base = { accountId: acct.id, date: '2026-01-15' };

    const expense = (await api('POST', '/transactions', { ...base, categoryId: food, type: 'expense', amount: 30.25 })).body;
    await api('POST', '/transactions', { ...base, categoryId: salary, type: 'income', amount: 500 });
    assert.equal((await api('GET', `/accounts/${acct.id}`)).body.balance, 569.75);

    await api('PUT', `/transactions/${expense.id}`, { ...base, categoryId: food, type: 'expense', amount: 50 });
    assert.equal((await api('GET', `/accounts/${acct.id}`)).body.balance, 550);

    assert.equal((await api('DELETE', `/transactions/${expense.id}`)).status, 204);
    assert.equal((await api('GET', `/accounts/${acct.id}`)).body.balance, 600);
  });

  it('avoids floating-point drift (0.1 + 0.2)', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Float Test', type: 'Cash' })).body;
    const food = await categoryIdByName('Food');
    for (const amount of [0.1, 0.2]) {
      await api('POST', '/transactions', { accountId: acct.id, categoryId: food, type: 'income', amount, date: '2026-01-01' });
    }
    assert.equal((await api('GET', `/accounts/${acct.id}`)).body.balance, 0.3);
  });

  it('refuses to delete an account with transactions unless cascade=true', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Doomed', type: 'Cash' })).body;
    const food = await categoryIdByName('Food');
    await api('POST', '/transactions', { accountId: acct.id, categoryId: food, type: 'expense', amount: 5, date: '2026-01-01' });

    assert.equal((await api('DELETE', `/accounts/${acct.id}`)).status, 409);
    assert.equal((await api('DELETE', `/accounts/${acct.id}?cascade=true`)).status, 204);
    assert.equal((await api('GET', `/accounts/${acct.id}`)).status, 404);
  });

  it('refuses to delete a category that has transactions', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Cat Test', type: 'Cash' })).body;
    const cat = (await api('POST', '/categories', { name: 'Pets', kind: 'expense' })).body;
    await api('POST', '/transactions', { accountId: acct.id, categoryId: cat.id, type: 'expense', amount: 5, date: '2026-01-01' });
    assert.equal((await api('DELETE', `/categories/${cat.id}`)).status, 409);
  });
});

describe('transaction validation', () => {
  let accountId;
  let categoryId;
  before(async () => {
    accountId = (await api('POST', '/accounts', { name: 'Validation', type: 'Cash' })).body.id;
    categoryId = await categoryIdByName('Other');
  });

  const good = () => ({ accountId, categoryId, type: 'expense', amount: 10, date: '2026-01-01' });

  for (const [label, patch] of [
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -5 }],
    ['too many decimals', { amount: 1.999 }],
    ['non-numeric amount', { amount: 'abc' }],
    ['bad type', { type: 'refund' }],
    ['impossible date', { date: '2026-02-30' }],
    ['wrong date format', { date: '01/02/2026' }],
    ['unknown account', { accountId: 9999 }],
    ['unknown category', { categoryId: 9999 }],
  ]) {
    it(`rejects ${label} with 400`, async () => {
      assert.equal((await api('POST', '/transactions', { ...good(), ...patch })).status, 400);
    });
  }

  it('returns 404 for a missing transaction', async () => {
    assert.equal((await api('GET', '/transactions/9999')).status, 404);
  });
});

describe('transaction listing', () => {
  let accountId;
  before(async () => {
    accountId = (await api('POST', '/accounts', { name: 'Listing', type: 'Bank' })).body.id;
    const food = await categoryIdByName('Food');
    const rent = await categoryIdByName('Rent');
    for (const [categoryId, amount, date] of [[food, 10, '2026-03-01'], [rent, 900, '2026-03-05'], [food, 20, '2026-04-01']]) {
      await api('POST', '/transactions', { accountId, categoryId, type: 'expense', amount, date });
    }
  });

  it('filters by account, category and date range', async () => {
    const food = await categoryIdByName('Food');
    const all = (await api('GET', `/transactions?accountId=${accountId}`)).body;
    assert.equal(all.length, 3);
    assert.equal((await api('GET', `/transactions?accountId=${accountId}&categoryId=${food}`)).body.length, 2);
    assert.equal((await api('GET', `/transactions?accountId=${accountId}&from=2026-03-02&to=2026-03-31`)).body.length, 1);
  });

  it('sorts by whitelisted columns and rejects others', async () => {
    const asc = (await api('GET', `/transactions?accountId=${accountId}&sort=amount&order=asc`)).body;
    assert.deepEqual(asc.map((t) => t.amount), [10, 20, 900]);
    assert.equal((await api('GET', '/transactions?sort=id;DROP TABLE accounts')).status, 400);
  });
});

describe('budgets', () => {
  const month = '2026-05';
  let food;
  let budgetId;
  before(async () => {
    food = await categoryIdByName('Food');
  });

  it('creates, rejects duplicates, updates and deletes', async () => {
    const created = await api('POST', '/budgets', { categoryId: food, month, amount: 300 });
    assert.equal(created.status, 201);
    budgetId = created.body.id;

    assert.equal((await api('POST', '/budgets', { categoryId: food, month, amount: 100 })).status, 409);
    assert.equal((await api('PUT', `/budgets/${budgetId}`, { amount: 350 })).body.amount, 350);
    assert.equal((await api('GET', `/budgets?month=${month}`)).body.length, 1);
    assert.equal((await api('DELETE', `/budgets/${budgetId}`)).status, 204);
    assert.equal((await api('GET', `/budgets?month=${month}`)).body.length, 0);
  });

  it('does not allow budgets on income categories', async () => {
    const salary = await categoryIdByName('Salary');
    assert.equal((await api('POST', '/budgets', { categoryId: salary, month, amount: 100 })).status, 400);
  });
});

describe('reports', () => {
  const month = '2026-06';
  let accountId;
  before(async () => {
    accountId = (await api('POST', '/accounts', { name: 'Reports', type: 'Bank' })).body.id;
    const food = await categoryIdByName('Food');
    const transport = await categoryIdByName('Transport');
    const salary = await categoryIdByName('Salary');
    const tx = (categoryId, type, amount, date) => api('POST', '/transactions', { accountId, categoryId, type, amount, date });

    await tx(salary, 'income', 1000, '2026-06-01');
    await tx(food, 'expense', 250, '2026-06-10');
    await tx(food, 'expense', 100, '2026-06-30');
    await tx(transport, 'expense', 40, '2026-06-15');
    await tx(food, 'expense', 999, '2026-07-01');
    await api('POST', '/budgets', { categoryId: food, month, amount: 300 });
  });

  it('summarises totals, category spending and budget status for one month', async () => {
    const { body } = await api('GET', `/reports/summary?month=${month}`);
    assert.equal(body.totalIncome, 1000);
    assert.equal(body.totalExpenses, 390);
    assert.equal(body.net, 610);
    assert.deepEqual(body.spendingByCategory.map((c) => [c.categoryName, c.spent]), [['Food', 350], ['Transport', 40]]);

    assert.equal(body.budgets.length, 1);
    assert.deepEqual(
      { name: body.budgets[0].categoryName, remaining: body.budgets[0].remaining, status: body.budgets[0].status },
      { name: 'Food', remaining: -50, status: 'over' },
    );
  });

  it('returns a zero-filled monthly trend, oldest first', async () => {
    const { body } = await api('GET', '/reports/trend?end=2026-07&months=3');
    assert.deepEqual(body, [
      { month: '2026-05', totalExpenses: 0 },
      { month: '2026-06', totalExpenses: 390 },
      { month: '2026-07', totalExpenses: 999 },
    ]);
  });

  it('defaults to the current month and validates input', async () => {
    assert.equal((await api('GET', '/reports/summary')).body.month, currentMonth());
    assert.equal((await api('GET', '/reports/summary?month=2026-13')).status, 400);
    assert.equal((await api('GET', '/reports/trend?months=0')).status, 400);
  });
});

describe('regressions', () => {
  it('rejects prototype property names as sort keys instead of failing with 500', async () => {
    for (const sort of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.equal((await api('GET', `/transactions?sort=${sort}`)).status, 400, sort);
    }
  });

  it('does not coerce booleans or arrays into ids', async () => {
    const category = await categoryIdByName('Food');
    const acct = (await api('POST', '/accounts', { name: 'Coercion', type: 'Cash' })).body;
    const base = { categoryId: category, type: 'expense', amount: 5, date: '2026-01-01' };
    for (const accountId of [true, [acct.id], '1e0', '0x1', String(acct.id) + 'abc']) {
      assert.equal((await api('POST', '/transactions', { ...base, accountId })).status, 400, JSON.stringify(accountId));
    }
    assert.equal((await api('POST', '/transactions', { ...base, accountId: acct.id })).status, 201);
    assert.equal((await api('POST', '/transactions', { ...base, accountId: String(acct.id) })).status, 201);
  });

  it('rejects hex and exponent amounts', async () => {
    for (const openingBalance of ['0x10', '1e2', '1.']) {
      assert.equal((await api('POST', '/accounts', { name: 'Bad money', type: 'Cash', openingBalance })).status, 400, openingBalance);
    }
  });

  it('names the duplicate in account and category conflicts', async () => {
    await api('POST', '/accounts', { name: 'Dupe', type: 'Cash' });
    const dup = await api('POST', '/accounts', { name: 'dupe', type: 'Bank' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error, 'An account named "dupe" already exists');

    const other = (await api('POST', '/accounts', { name: 'Other acct', type: 'Cash' })).body;
    const rename = await api('PUT', `/accounts/${other.id}`, { name: 'DUPE', type: 'Cash' });
    assert.equal(rename.status, 409);
    assert.match(rename.body.error, /already exists/);

    const cat = await api('POST', '/categories', { name: 'food', kind: 'expense' });
    assert.equal(cat.status, 409);
    assert.equal(cat.body.error, 'A category named "food" already exists');
  });

  it('keeps an account renamable to its own name', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Same name', type: 'Cash' })).body;
    const res = await api('PUT', `/accounts/${acct.id}`, { name: 'Same name', type: 'Bank', openingBalance: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.body.type, 'Bank');
  });

  it('will not turn a category with budgets into an income category', async () => {
    const cat = (await api('POST', '/categories', { name: 'Gifts', kind: 'expense' })).body;
    await api('POST', '/budgets', { categoryId: cat.id, month: '2026-08', amount: 50 });
    const res = await api('PUT', `/categories/${cat.id}`, { name: 'Gifts', kind: 'income' });
    assert.equal(res.status, 409);
    assert.equal((await api('PUT', `/categories/${cat.id}`, { name: 'Gifts', kind: 'both' })).status, 200);
  });

  it('returns 404 for updates and deletes of missing records', async () => {
    assert.equal((await api('PUT', '/accounts/9999', { name: 'x', type: 'y' })).status, 404);
    assert.equal((await api('DELETE', '/accounts/9999')).status, 404);
    assert.equal((await api('PUT', '/categories/9999', { name: 'x', kind: 'expense' })).status, 404);
    assert.equal((await api('DELETE', '/categories/9999')).status, 404);
    assert.equal((await api('PUT', '/budgets/9999', { amount: 5 })).status, 404);
    assert.equal((await api('DELETE', '/budgets/9999')).status, 404);
    assert.equal((await api('DELETE', '/transactions/9999')).status, 404);
  });

  it('validates report parameters', async () => {
    assert.equal((await api('GET', '/reports/trend?months=37')).status, 400);
    assert.equal((await api('GET', '/reports/trend?months=1.5')).status, 400);
    assert.equal((await api('GET', '/reports/trend?end=2026-99')).status, 400);
    assert.equal((await api('GET', '/reports/trend?months=1&end=2026-01')).body.length, 1);
    assert.equal((await api('GET', '/budgets?month=nope')).status, 400);
  });

  it('reports an empty month with zeros and no budgets', async () => {
    const { body } = await api('GET', '/reports/summary?month=1999-01');
    assert.deepEqual(body, {
      month: '1999-01',
      totalIncome: 0,
      totalExpenses: 0,
      net: 0,
      spendingByCategory: [],
      budgets: [],
    });
  });

  it('treats spending exactly equal to the budget as under budget', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Exact', type: 'Cash' })).body;
    const cat = await categoryIdByName('Utilities');
    await api('POST', '/transactions', { accountId: acct.id, categoryId: cat, type: 'expense', amount: 100, date: '2026-04-10' });
    await api('POST', '/budgets', { categoryId: cat, month: '2026-04', amount: 100 });
    const { body } = await api('GET', '/reports/summary?month=2026-04');
    const budget = body.budgets.find((b) => b.categoryName === 'Utilities');
    assert.equal(budget.status, 'under');
    assert.equal(budget.remaining, 0);
    assert.equal(budget.percentUsed, 100);
  });

  it('ignores income when computing spending by category', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Refund', type: 'Cash' })).body;
    const cat = await categoryIdByName('Shopping');
    await api('POST', '/transactions', { accountId: acct.id, categoryId: cat, type: 'income', amount: 40, date: '2026-02-10' });
    const { body } = await api('GET', '/reports/summary?month=2026-02');
    assert.equal(body.totalIncome, 40);
    assert.equal(body.totalExpenses, 0);
    assert.deepEqual(body.spendingByCategory, []);
  });

  it('combines every filter with AND and returns nothing for an inverted range', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Filter combo', type: 'Bank' })).body;
    const food = await categoryIdByName('Food');
    await api('POST', '/transactions', { accountId: acct.id, categoryId: food, type: 'expense', amount: 9, date: '2026-05-05' });
    const q = `accountId=${acct.id}&categoryId=${food}&type=expense&from=2026-05-01&to=2026-05-31`;
    assert.equal((await api('GET', `/transactions?${q}`)).body.length, 1);
    const asIncome = q.replace('type=expense', 'type=income');
    assert.equal((await api('GET', `/transactions?${asIncome}`)).body.length, 0);
    assert.equal((await api('GET', `/transactions?${q}&type=income`)).status, 400);
    assert.equal((await api('GET', `/transactions?accountId=${acct.id}&from=2026-06-01&to=2026-05-01`)).body.length, 0);
  });

  it('breaks sort ties by newest id and honours ascending order', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Ties', type: 'Bank' })).body;
    const food = await categoryIdByName('Food');
    const add = (amount) =>
      api('POST', '/transactions', { accountId: acct.id, categoryId: food, type: 'expense', amount, date: '2026-07-07' });
    const first = (await add(1)).body;
    const second = (await add(2)).body;
    const rows = (await api('GET', `/transactions?accountId=${acct.id}&sort=date&order=desc`)).body;
    assert.deepEqual(rows.map((r) => r.id), [second.id, first.id]);
  });

  it('cascade delete removes the transactions and changes the totals', async () => {
    const acct = (await api('POST', '/accounts', { name: 'Cascade', type: 'Cash' })).body;
    const food = await categoryIdByName('Food');
    await api('POST', '/transactions', { accountId: acct.id, categoryId: food, type: 'expense', amount: 11, date: '2025-03-03' });
    assert.equal((await api('GET', '/reports/summary?month=2025-03')).body.totalExpenses, 11);
    await api('DELETE', `/accounts/${acct.id}?cascade=true`);
    assert.equal((await api('GET', '/reports/summary?month=2025-03')).body.totalExpenses, 0);
  });
});

describe('errors', () => {
  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    assert.equal((await api('GET', '/nope')).status, 404);
    const res = await fetch(`${base}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
  });
});
