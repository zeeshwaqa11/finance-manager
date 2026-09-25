import { useState } from 'react';
import { budgetsApi, categoriesApi, reportsApi } from '../api/index.js';
import MonthSelector from '../components/MonthSelector.jsx';
import Status from '../components/Status.jsx';
import { useApi } from '../hooks/useApi.js';
import { addMonths, currentMonth, formatMoney, formatMonth } from '../utils/format.js';

function BudgetRow({ category, budget, spent, month, onChanged, onError }) {
  const [value, setValue] = useState(budget ? String(budget.amount) : '');
  const [busy, setBusy] = useState(false);

  const amount = Number(value);
  const dirty = value !== (budget ? String(budget.amount) : '');

  async function run(action) {
    setBusy(true);
    try {
      await action();
      onError(null);
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(() => (budget ? budgetsApi.update(budget.id, amount) : budgetsApi.create({ categoryId: category.id, month, amount })));
  const remove = () => run(() => budgetsApi.remove(budget.id));

  return (
    <tr>
      <td>{category.name}</td>
      <td className="num">{formatMoney(spent)}</td>
      <td>
        <div className="budget-input">
          <span aria-hidden="true">Rs</span>
          <input
            type="number" min="0.01" step="0.01" placeholder="No budget"
            value={value} onChange={(e) => setValue(e.target.value)}
            aria-label={`${category.name} budget`}
          />
          <button className="btn-secondary" onClick={save} disabled={busy || !dirty || !(amount > 0)}>Save</button>
          <button className="btn-ghost btn-danger" onClick={remove} disabled={busy || !budget}>Remove</button>
        </div>
      </td>
    </tr>
  );
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [actionError, setActionError] = useState(null);
  const [info, setInfo] = useState(null);

  const categories = useApi(categoriesApi.list);
  const budgets = useApi(() => budgetsApi.list(month), [month]);
  const summary = useApi(() => reportsApi.summary(month), [month]);

  const prevMonth = addMonths(month, -1);
  const error = categories.error || budgets.error || summary.error;
  const ready = categories.data && budgets.data && summary.data;

  const reload = () => {
    budgets.reload();
    summary.reload();
  };

  async function copyFromPrevious() {
    try {
      const previous = await budgetsApi.list(prevMonth);
      const existing = new Set(budgets.data.map((b) => b.categoryId));
      const missing = previous.filter((b) => !existing.has(b.categoryId));
      await Promise.all(missing.map((b) => budgetsApi.create({ categoryId: b.categoryId, month, amount: b.amount })));
      setActionError(null);
      setInfo(missing.length ? null : `Nothing to copy: no new budgets in ${formatMonth(prevMonth)}.`);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const spentBy = new Map(summary.data?.spendingByCategory.map((s) => [s.categoryId, s.spent]));
  const budgetBy = new Map(budgets.data?.map((b) => [b.categoryId, b]));
  const expenseCategories = categories.data?.filter((c) => c.kind !== 'income') ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Budgets</h1>
        <MonthSelector
          month={month}
          onChange={(m) => {
            setMonth(m);
            setInfo(null);
            setActionError(null);
          }}
        />
      </div>

      <p className="muted">
        Set a monthly spending limit per category. Categories left blank have no budget and are not flagged
        as over or under on the dashboard.
      </p>

      <Status loading={!ready && !error} error={error} onRetry={() => { categories.reload(); reload(); }} />
      {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}
      {info && <div className="notice notice-info" role="status">{info}</div>}

      {ready && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Spent in {formatMonth(month, { short: true })}</th>
                  <th className="num">Monthly budget</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((c) => (
                  <BudgetRow
                    key={`${month}-${c.id}-${budgetBy.get(c.id)?.amount ?? 'none'}`}
                    category={c}
                    budget={budgetBy.get(c.id)}
                    spent={spentBy.get(c.id) ?? 0}
                    month={month}
                    onChanged={reload}
                    onError={setActionError}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '12px 0 0' }}>
            <button className="btn-link" onClick={copyFromPrevious}>Copy budgets from {formatMonth(prevMonth)}</button>
          </p>
        </div>
      )}
    </>
  );
}
