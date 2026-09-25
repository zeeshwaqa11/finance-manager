import { useState } from 'react';
import { transactionsApi } from '../api/index.js';
import { todayISO } from '../utils/format.js';

export default function TransactionForm({ transaction, accounts, categories, onSaved, onCancel }) {
  const [form, setForm] = useState({
    type: transaction?.type ?? 'expense',
    amount: transaction?.amount ?? '',
    accountId: transaction?.accountId ?? accounts[0]?.id ?? '',
    categoryId: transaction?.categoryId ?? '',
    date: transaction?.date ?? todayISO(),
    note: transaction?.note ?? '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const options = categories.filter(
    (c) => c.kind === 'both' || c.kind === form.type || c.id === transaction?.categoryId,
  );
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function setType(type) {
    const stillValid = categories.some((c) => c.id === Number(form.categoryId) && (c.kind === 'both' || c.kind === type));
    setForm({ ...form, type, categoryId: stillValid ? form.categoryId : '' });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...form,
        amount: Number(form.amount),
        accountId: Number(form.accountId),
        categoryId: Number(form.categoryId),
      };
      await (transaction ? transactionsApi.update(transaction.id, data) : transactionsApi.create(data));
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <>
        <p>You need at least one account before adding transactions.</p>
        <div className="form-actions"><button className="btn-secondary" onClick={onCancel}>Close</button></div>
      </>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <div className="segmented" role="radiogroup" aria-label="Type">
        {['expense', 'income'].map((t) => (
          <label key={t}>
            <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => setType(t)} />
            {t === 'expense' ? 'Expense' : 'Income'}
          </label>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          Amount ($)
          <input type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} required autoFocus />
        </label>
        <label className="field">
          Date
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          Account
          <select value={form.accountId} onChange={set('accountId')} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field">
          Category
          <select value={form.categoryId} onChange={set('categoryId')} required>
            <option value="" disabled>Select…</option>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        Note (optional)
        <input value={form.note} onChange={set('note')} maxLength={500} />
      </label>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={saving}>{transaction ? 'Save changes' : 'Add transaction'}</button>
      </div>
    </form>
  );
}
