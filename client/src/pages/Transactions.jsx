import { useState } from 'react';
import { accountsApi, categoriesApi, transactionsApi } from '../api/index.js';
import Modal from '../components/Modal.jsx';
import Status from '../components/Status.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatDate, formatMoney } from '../utils/format.js';

const NO_FILTERS = { accountId: '', categoryId: '', type: '', from: '', to: '' };

const COLUMNS = [
  ['date', 'Date'],
  ['account', 'Account'],
  ['category', 'Category'],
  ['amount', 'Amount', true],
];

export default function Transactions() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ by: 'date', order: 'desc' });
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: transactions, error, loading, reload } = useApi(
    () => transactionsApi.list({ ...filters, sort: sort.by, order: sort.order }),
    [filters, sort],
    { keepPrevious: true },
  );
  const { data: accounts } = useApi(accountsApi.list);
  const { data: categories } = useApi(categoriesApi.list);

  const setFilter = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });
  const filtersActive = Object.values(filters).some(Boolean);

  function toggleSort(by) {
    setSort((s) =>
      s.by === by ? { by, order: s.order === 'asc' ? 'desc' : 'asc' } : { by, order: by === 'date' || by === 'amount' ? 'desc' : 'asc' },
    );
  }

  async function remove(t) {
    if (!window.confirm(`Delete this ${formatMoney(t.amount)} ${t.categoryName} transaction?`)) return;
    try {
      await transactionsApi.remove(t.id);
      setActionError(null);
      reload();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const net = transactions?.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <h1>Transactions</h1>
        <button className="btn" onClick={() => setEditing('new')} disabled={!accounts || !categories}>
          Add transaction
        </button>
      </div>

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
            <option value="">Income & expense</option>
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
        {filtersActive && (
          <button className="btn-link" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
        )}
      </div>

      <Status loading={loading && !transactions} error={error} onRetry={reload} />
      {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}

      {transactions && (
        <div className="card">
          {transactions.length === 0 ? (
            <p className="empty">{filtersActive ? 'No transactions match these filters.' : 'No transactions yet.'}</p>
          ) : (
            <div className="table-wrap">
              <table>
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
                          {sort.by === key && <span aria-hidden="true">{sort.order === 'asc' ? '▲' : '▼'}</span>}
                        </button>
                      </th>
                    ))}
                    <th>Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.accountName}</td>
                      <td>{t.categoryName}</td>
                      <td className={`num ${t.type}`}>
                        {t.type === 'income' ? '+' : '−'}{formatMoney(t.amount)}
                      </td>
                      <td className="note">{t.note}</td>
                      <td className="actions">
                        <button className="btn-ghost" onClick={() => setEditing(t)}>Edit</button>
                        <button className="btn-ghost btn-danger" onClick={() => remove(t)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ margin: '12px 0 0' }}>
            {transactions.length} transaction{transactions.length === 1 ? '' : 's'} · Net {formatMoney(net)}
          </p>
        </div>
      )}

      {editing && accounts && categories && (
        <Modal title={editing === 'new' ? 'Add transaction' : 'Edit transaction'} onClose={() => setEditing(null)}>
          <TransactionForm
            transaction={editing === 'new' ? null : editing}
            accounts={accounts}
            categories={categories}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
