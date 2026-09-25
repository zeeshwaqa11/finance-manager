import { useState } from 'react';
import { accountsApi } from '../api/index.js';

const SUGGESTED_TYPES = ['Cash', 'Bank', 'Credit Card'];

export default function AccountForm({ account, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: account?.name ?? '',
    type: account?.type ?? 'Bank',
    openingBalance: account?.openingBalance ?? 0,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = { ...form, openingBalance: Number(form.openingBalance) };
      await (account ? accountsApi.update(account.id, data) : accountsApi.create(data));
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <label className="field">
        Name
        <input value={form.name} onChange={set('name')} required maxLength={100} autoFocus />
      </label>

      <label className="field">
        Type
        <input value={form.type} onChange={set('type')} required maxLength={50} list="account-types" />
        <datalist id="account-types">
          {SUGGESTED_TYPES.map((t) => <option key={t} value={t} />)}
        </datalist>
      </label>

      <label className="field">
        Opening balance ($)
        <input type="number" step="0.01" value={form.openingBalance} onChange={set('openingBalance')} required />
        <span className="muted">The balance before any transactions. Use a negative number for existing debt.</span>
      </label>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn" disabled={saving}>{account ? 'Save changes' : 'Add account'}</button>
      </div>
    </form>
  );
}
