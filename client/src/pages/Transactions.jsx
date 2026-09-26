import { useState } from 'react';
import { accountsApi, categoriesApi, transactionsApi } from '../api/index.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Status from '../components/Status.jsx';
import { useToast } from '../components/Toast.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { useApi } from '../hooks/useApi.js';
import { assignCategoryColors, useChartTheme } from '../hooks/useChartTheme.js';
import { formatDate, formatMoney } from '../utils/format.js';

const NO_FILTERS = { accountId: '', categoryId: '', type: '', from: '', to: '' };

const COLUMNS = [
  ['date', 'Date'],
  ['category', 'Category'],
  ['account', 'Account'],
  ['amount', 'Amount', true],
];

export default function Transactions() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ by: 'date', order: 'desc' });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { notify } = useToast();
  const theme = useChartTheme();

  const { data: transactions, error, loading, reload } = useApi(
    () => transactionsApi.list({ ...filters, sort: sort.by, order: sort.order }),
    [filters, sort],
    { keepPrevious: true },
  );
  const { data: accounts } = useApi(accountsApi.list);
  const { data: categories } = useApi(categoriesApi.list);
  const colors = categories ? assignCategoryColors(categories, theme) : new Map();

  const setFilter = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });
  const filtersActive = Object.values(filters).some(Boolean);

  function toggleSort(by) {
    setSort((s) =>
      s.by === by ? { by, order: s.order === 'asc' ? 'desc' : 'asc' } : { by, order: by === 'date' || by === 'amount' ? 'desc' : 'asc' },
    );
  }

  async function confirmDelete() {
    await transactionsApi.remove(deleting.id);
    setDeleting(null);
    notify('Transaction deleted');
    reload();
  }

  const income = transactions?.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : 0), 0) ?? 0;
  const expenses = transactions?.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0) ?? 0;
  const net = income - expenses;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p className="page-sub">Filter, sort and manage everything you have recorded</p>
        </div>
        <button className="btn" onClick={() => setEditing('new')} disabled={!accounts || !categories}>
          <Icon name="plus" size={18} />
          Add transaction
        </button>
      </div>

      <section className="card filters-card">
        <div className="filters">
          <label className="field">
            Account
            <select value={filters.accountId} onChange={setFilter('accountId')}>
              <option value="">All accounts</option>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="field">
            Category
            <select value={filters.categoryId} onChange={setFilter('categoryId')}>
              <option value="">All categories</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            Type
            <select value={filters.type} onChange={setFilter('type')}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="field">
            From
            <input type="date" value={filters.from} onChange={setFilter('from')} />
          </label>
          <label className="field">
            To
            <input type="date" value={filters.to} onChange={setFilter('to')} />
          </label>
        </div>
        {filtersActive && (
          <button className="btn-link clear-filters" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
        )}
      </section>

      <Status loading={loading && !transactions} error={error} onRetry={reload} />

      {transactions && (
        <div className="stack">
          <div className="summary-row">
            <div className="chip">
              <span className="chip-label">Income</span>
              <span className="chip-value income">{formatMoney(income)}</span>
            </div>
            <div className="chip">
              <span className="chip-label">Expenses</span>
              <span className="chip-value">{formatMoney(expenses)}</span>
            </div>
            <div className="chip">
              <span className="chip-label">Net</span>
              <span className={`chip-value ${net < 0 ? 'negative' : net > 0 ? 'income' : ''}`}>{formatMoney(net)}</span>
            </div>
            <span className="result-count">
              {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="card table-card">
            {transactions.length === 0 ? (
              <EmptyState icon="receipt">
                {filtersActive ? 'No transactions match these filters.' : 'No transactions yet.'}
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      {COLUMNS.map(([key, label, right]) => (
                        <th
                          key={key}
                          className={right ? 'num' : undefined}
                          aria-sort={sort.by === key ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <button onClick={() => toggleSort(key)}>
                            {label}
                            {sort.by === key && <Icon name={sort.order === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />}
                          </button>
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="tx-date">{formatDate(t.date)}</td>
                        <td className="tx-category">
                          <div className="cat-cell">
                            <span className="dot" style={{ background: colors.get(t.categoryId) ?? theme.muted }} />
                            <div>
                              <div className="tx-cat-name">{t.categoryName}</div>
                              {t.note && <div className="tx-note">{t.note}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="tx-account">{t.accountName}</td>
                        <td className={`num tx-amount ${t.type}`}>
                          {t.type === 'income' ? '+' : '−'}{formatMoney(t.amount)}
                        </td>
                        <td className="actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setEditing(t)}
                              aria-label={`Edit ${t.categoryName} transaction from ${formatDate(t.date)}`}
                              title="Edit"
                            >
                              <Icon name="edit" size={18} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-danger"
                              onClick={() => setDeleting(t)}
                              aria-label={`Delete ${t.categoryName} transaction from ${formatDate(t.date)}`}
                              title="Delete"
                            >
                              <Icon name="trash" size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete transaction"
          message={`Delete this ${formatMoney(deleting.amount)} ${deleting.categoryName} transaction from ${formatDate(deleting.date)}? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {editing && accounts && categories && (
        <Modal title={editing === 'new' ? 'Add transaction' : 'Edit transaction'} onClose={() => setEditing(null)}>
          <TransactionForm
            transaction={editing === 'new' ? null : editing}
            accounts={accounts}
            categories={categories}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              notify(editing === 'new' ? 'Transaction added' : 'Transaction updated');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
