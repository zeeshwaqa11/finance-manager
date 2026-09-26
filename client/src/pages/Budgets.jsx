import { useState } from 'react';
import { budgetsApi, categoriesApi, reportsApi } from '../api/index.js';
import Icon from '../components/Icon.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import Status from '../components/Status.jsx';
import { useToast } from '../components/Toast.jsx';
import { useApi } from '../hooks/useApi.js';
import { assignCategoryColors, useChartTheme } from '../hooks/useChartTheme.js';
import { addMonths, currentMonth, formatMoney, formatMonth } from '../utils/format.js';

function BudgetItem({ category, color, budget, spent, month, onChanged, onError, onDone }) {
  const [value, setValue] = useState(budget ? String(budget.amount) : '');
  const [busy, setBusy] = useState(false);

  const amount = Number(value);
  const dirty = value !== (budget ? String(budget.amount) : '');
  const percent = budget ? (spent / budget.amount) * 100 : 0;
  const over = budget && spent > budget.amount;

  async function run(action, doneMessage) {
    setBusy(true);
    try {
      await action();
      onError(null);
      onDone(doneMessage);
      onChanged();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(
      () => (budget ? budgetsApi.update(budget.id, amount) : budgetsApi.create({ categoryId: category.id, month, amount })),
      `${category.name} budget saved`,
    );
  const remove = () => run(() => budgetsApi.remove(budget.id), `${category.name} budget removed`);

  return (
    <li className="budget-item">
      <div className="budget-item-head">
        <span className="dot" style={{ background: color }} />
        <strong>{category.name}</strong>
        <span className="budget-spent">
          Spent <b>{formatMoney(spent)}</b>
        </span>
      </div>

      {budget && (
        <div
          className="progress"
          role="progressbar"
          aria-label={`${category.name} budget used`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(Math.round(percent), 100)}
        >
          <div className={over ? 'over' : 'under'} style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      )}

      <div className="budget-input">
        <span className="budget-prefix" aria-hidden="true">Rs</span>
        <input
          type="number" min="0.01" step="0.01" placeholder="No budget"
          value={value} onChange={(e) => setValue(e.target.value)}
          aria-label={`${category.name} budget`}
        />
        <button className="btn-secondary" onClick={save} disabled={busy || !dirty || !(amount > 0)}>Save</button>
        <button className="btn-ghost btn-danger" onClick={remove} disabled={busy || !budget}>Remove</button>
      </div>
    </li>
  );
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [actionError, setActionError] = useState(null);
  const [info, setInfo] = useState(null);
  const { notify } = useToast();
  const theme = useChartTheme();

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
      if (missing.length) notify(`Copied ${missing.length} budget${missing.length === 1 ? '' : 's'} from ${formatMonth(prevMonth)}`);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const spentBy = new Map(summary.data?.spendingByCategory.map((s) => [s.categoryId, s.spent]));
  const budgetBy = new Map(budgets.data?.map((b) => [b.categoryId, b]));
  const expenseCategories = categories.data?.filter((c) => c.kind !== 'income') ?? [];
  const colors = categories.data ? assignCategoryColors(categories.data, theme) : new Map();

  const budgeted = budgets.data?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
  const spentOnBudgeted = budgets.data?.reduce((sum, b) => sum + (spentBy.get(b.categoryId) ?? 0), 0) ?? 0;
  const overall = budgeted > 0 ? (spentOnBudgeted / budgeted) * 100 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Budgets</h1>
          <p className="page-sub">Set a monthly spending limit for each category</p>
        </div>
        <MonthSelector
          month={month}
          onChange={(m) => {
            setMonth(m);
            setInfo(null);
            setActionError(null);
          }}
        />
      </div>

      <Status loading={!ready && !error} error={error} onRetry={() => { categories.reload(); reload(); }} />
      {actionError && (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{actionError}</span>
        </div>
      )}
      {info && (
        <div className="notice notice-info" role="status">
          <Icon name="check" size={18} />
          <span>{info}</span>
        </div>
      )}

      {ready && (
        <div className="stack">
          {budgets.data.length > 0 && (
            <section className="card budget-summary">
              <div>
                <div className="stat-label">Total budgeted</div>
                <div className="net-value">{formatMoney(budgeted)}</div>
              </div>
              <div className="budget-summary-progress">
                <div className="budget-summary-line">
                  <span>{`${formatMoney(spentOnBudgeted)} of ${formatMoney(budgeted)}`}</span>
                  <span className="muted">{Math.round(overall)}% used</span>
                </div>
                <div className="progress" aria-hidden="true">
                  <div className={overall > 100 ? 'over' : 'under'} style={{ width: `${Math.min(overall, 100)}%` }} />
                </div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Spending limits</h2>
              <span className="card-note">Categories left blank are not flagged on the dashboard</span>
            </div>
            <ul className="budget-list">
              {expenseCategories.map((c) => (
                <BudgetItem
                  key={`${month}-${c.id}-${budgetBy.get(c.id)?.amount ?? 'none'}`}
                  category={c}
                  color={colors.get(c.id) ?? theme.muted}
                  budget={budgetBy.get(c.id)}
                  spent={spentBy.get(c.id) ?? 0}
                  month={month}
                  onChanged={reload}
                  onError={setActionError}
                  onDone={notify}
                />
              ))}
            </ul>
            <button className="btn-link copy-link" onClick={copyFromPrevious}>
              <Icon name="copy" size={16} />
              Copy budgets from {formatMonth(prevMonth)}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
