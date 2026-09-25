import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.DB_PATH = ':memory:';

const { createApp } = await import('../src/app.js');
const { currentMonth, addMonths } = await import('../src/utils/dates.js');

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

describe('dates', () => {
  it('addMonths crosses year boundaries', () => {
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonths('2026-11', 3), '2027-02');
  });
});

describe('errors', () => {
  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    assert.equal((await api('GET', '/nope')).status, 404);
    const res = await fetch(`${base}/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    assert.equal(res.status, 400);
  });
});
