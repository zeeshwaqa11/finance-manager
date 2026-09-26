import { useState } from 'react';
import { categoriesApi, reportsApi } from '../api/index.js';
import { SpendingDoughnut, TrendBars } from '../components/charts.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import MonthSelector from '../components/MonthSelector.jsx';
import Status from '../components/Status.jsx';
import { useApi } from '../hooks/useApi.js';
import { assignCategoryColors, useChartTheme } from '../hooks/useChartTheme.js';
import { currentMonth, formatMoney, formatMonth } from '../utils/format.js';

function StatCard({ icon, tone, label, value, caption, className = '' }) {
  return (
    <div className="card stat-card">
      <span className={`tile tile-${tone}`}>
        <Icon name={icon} />
      </span>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className={`stat-value ${className}`}>{value}</div>
        {caption && <div className="stat-caption">{caption}</div>}
      </div>
    </div>
  );
}

function BudgetRow({ b, color }) {
  const over = b.status === 'over';
  return (
    <div className="budget-row">
      <div className="budget-top">
        <span className="budget-name">
          <span className="dot" style={{ background: color }} />
          <strong>{b.categoryName}</strong>
        </span>
        <span className="budget-figures">{formatMoney(b.spent)} of {formatMoney(b.budget)}</span>
      </div>
      <div
        className="progress" role="progressbar" aria-label={`${b.categoryName} budget used`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.percentUsed, 100)}
      >
        <div className={over ? 'over' : 'under'} style={{ width: `${Math.min(b.percentUsed, 100)}%` }} />
      </div>
      <div className={`budget-status ${b.status}`}>
        <Icon name={over ? 'alert' : 'check'} size={14} />
        {over
          ? `Over budget by ${formatMoney(-b.remaining)} (${b.percentUsed}%)`
          : `Under budget, ${formatMoney(b.remaining)} left (${b.percentUsed}%)`}
      </div>
    </div>
  );
}

function percentOf(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const theme = useChartTheme();

  const summary = useApi(() => reportsApi.summary(month), [month], { keepPrevious: true });
  const trend = useApi(() => reportsApi.trend(month, 6), [month], { keepPrevious: true });
  const categories = useApi(categoriesApi.list);

  const error = summary.error || trend.error || categories.error;
  const s = summary.data;
  const ready = s && categories.data && trend.data;
  const colors = categories.data ? assignCategoryColors(categories.data, theme) : new Map();

  const items = s?.spendingByCategory.map((c) => ({ id: c.categoryId, name: c.categoryName, value: c.spent })) ?? [];

  const spentShare = s ? percentOf(s.totalExpenses, s.totalIncome) : null;
  const savedShare = s && s.net > 0 ? percentOf(s.net, s.totalIncome) : null;
  const netCaption = savedShare !== null
    ? `Saved ${savedShare}% of income`
    : s && s.net < 0 ? 'Spending exceeds income' : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">{ready ? `Overview for ${formatMonth(month)}` : 'Your money at a glance'}</p>
        </div>
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <Status
        loading={!ready && !error}
        error={error}
        onRetry={() => { summary.reload(); trend.reload(); categories.reload(); }}
      />

      {ready && (
        <div className="stack">
          <div className="grid grid-3">
            <StatCard
              icon="arrow-down-left"
              tone="income"
              label="Income"
              value={formatMoney(s.totalIncome)}
              className="income"
              caption="Money received"
            />
            <StatCard
              icon="arrow-up-right"
              tone="expense"
              label="Expenses"
              value={formatMoney(s.totalExpenses)}
              caption={spentShare !== null ? `${spentShare}% of income` : null}
            />
            <StatCard
              icon="wallet"
              tone="net"
              label="Net"
              value={`${s.net > 0 ? '+' : ''}${formatMoney(s.net)}`}
              className={s.net < 0 ? 'negative' : s.net > 0 ? 'income' : ''}
              caption={netCaption}
            />
          </div>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-head">
                <h2>Spending by category</h2>
              </div>
              {items.length === 0 ? (
                <EmptyState icon="pie">No expenses in {formatMonth(month)}.</EmptyState>
              ) : (
                <>
                  <div className="chart-box">
                    <SpendingDoughnut items={items} colors={colors} total={s.totalExpenses} />
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
              <div className="card-head">
                <h2>Budgets</h2>
              </div>
              {s.budgets.length === 0 ? (
                <EmptyState icon="target">No budgets set for {formatMonth(month)}. Add some on the Budgets page.</EmptyState>
              ) : (
                s.budgets.map((b) => <BudgetRow key={b.categoryId} b={b} color={colors.get(b.categoryId) ?? theme.muted} />)
              )}
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <h2>Spending, last 6 months</h2>
              <span className="card-note">{formatMonth(month)} highlighted</span>
            </div>
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
        </div>
      )}
    </>
  );
}
