import { useState } from 'react';
import { categoriesApi, reportsApi } from '../api/index.js';
import { SpendingDoughnut, TrendBars } from '../components/charts.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import Status from '../components/Status.jsx';
import { useApi } from '../hooks/useApi.js';
import { assignCategoryColors, useChartTheme } from '../hooks/useChartTheme.js';
import { currentMonth, formatMoney, formatMonth } from '../utils/format.js';

function StatCard({ label, value, className = '' }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{value}</div>
    </div>
  );
}

function BudgetRow({ b }) {
  const over = b.status === 'over';
  return (
    <div className="budget-row">
      <div className="budget-top">
        <strong>{b.categoryName}</strong>
        <span>{formatMoney(b.spent)} of {formatMoney(b.budget)}</span>
      </div>
      <div
        className="progress" role="progressbar" aria-label={`${b.categoryName} budget used`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.percentUsed, 100)}
      >
        <div className={over ? 'over' : 'under'} style={{ width: `${Math.min(b.percentUsed, 100)}%` }} />
      </div>
      <div className={`budget-status ${b.status}`}>
        {over
          ? `▲ Over budget by ${formatMoney(-b.remaining)} (${b.percentUsed}%)`
          : `✓ Under budget, ${formatMoney(b.remaining)} left (${b.percentUsed}%)`}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const theme = useChartTheme();

  const summary = useApi(() => reportsApi.summary(month), [month]);
  const trend = useApi(() => reportsApi.trend(month, 6), [month]);
  const categories = useApi(categoriesApi.list);

  const error = summary.error || trend.error || categories.error;
  const s = summary.data;
  const ready = s && categories.data && trend.data;
  const colors = categories.data ? assignCategoryColors(categories.data, theme) : new Map();

  const items = s?.spendingByCategory.map((c) => ({ id: c.categoryId, name: c.categoryName, value: c.spent })) ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <Status
        loading={!ready && !error}
        error={error}
        onRetry={() => { summary.reload(); trend.reload(); categories.reload(); }}
      />

      {ready && (
        <>
          <div className="grid grid-3">
            <StatCard label="Income" value={formatMoney(s.totalIncome)} className="income" />
            <StatCard label="Expenses" value={formatMoney(s.totalExpenses)} />
            <StatCard
              label="Net"
              value={`${s.net > 0 ? '+' : ''}${formatMoney(s.net)}`}
              className={s.net < 0 ? 'negative' : s.net > 0 ? 'income' : ''}
            />
          </div>

          <div className="grid grid-2 mt">
            <section className="card">
              <h2>Spending by category</h2>
              {items.length === 0 ? (
                <p className="empty">No expenses in {formatMonth(month)}.</p>
              ) : (
                <>
                  <div className="chart-box">
                    <SpendingDoughnut items={items} colors={colors} />
                  </div>
                  <ul className="legend">
                    {items.map((i) => (
                      <li key={i.id}>
                        <span className="swatch" style={{ background: colors.get(i.id) ?? theme.muted }} />
                        <span className="name">{i.name}</span>
                        <span className="value">{formatMoney(i.value)}</span>
                        <span className="pct">{Math.round((i.value / s.totalExpenses) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="card">
              <h2>Budgets</h2>
              {s.budgets.length === 0 ? (
                <p className="empty">No budgets set for {formatMonth(month)}. Add some on the Budgets page.</p>
              ) : (
                s.budgets.map((b) => <BudgetRow key={b.categoryId} b={b} />)
              )}
            </section>
          </div>

          <section className="card mt">
            <h2>Spending, last 6 months</h2>
            <div className="chart-box">
              <TrendBars trend={trend.data} selectedMonth={month} />
            </div>
            <details>
              <summary>View as table</summary>
              <table>
                <thead>
                  <tr><th>Month</th><th className="num">Total spending</th></tr>
                </thead>
                <tbody>
                  {trend.data.map((t) => (
                    <tr key={t.month}>
                      <td>{formatMonth(t.month)}</td>
                      <td className="num">{formatMoney(t.totalExpenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        </>
      )}
    </>
  );
}
