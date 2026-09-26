import { useState } from 'react';
import { accountsApi } from '../api/index.js';
import AccountForm from '../components/AccountForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon, { accountIcon } from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Status from '../components/Status.jsx';
import { useToast } from '../components/Toast.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatMoney } from '../utils/format.js';

function deleteMessage(account) {
  const n = account.transactionCount;
  if (!n) return `Delete "${account.name}"? This cannot be undone.`;
  return `Delete "${account.name}" and its ${n} transaction${n === 1 ? '' : 's'}? This cannot be undone.`;
}

function AccountCard({ account, onEdit, onDelete }) {
  const n = account.transactionCount;
  return (
    <article className="card account-card">
      <div className="account-top">
        <span className="tile tile-account">
          <Icon name={accountIcon(account.type)} />
        </span>
        <div className="account-title">
          <h3>{account.name}</h3>
          <span className="muted">{account.type}</span>
        </div>
        <div className="row-actions">
          <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Edit ${account.name}`} title="Edit">
            <Icon name="edit" size={18} />
          </button>
          <button type="button" className="icon-btn icon-btn-danger" onClick={onDelete} aria-label={`Delete ${account.name}`} title="Delete">
            <Icon name="trash" size={18} />
          </button>
        </div>
      </div>
      <div className={`account-balance ${account.balance < 0 ? 'negative' : ''}`}>{formatMoney(account.balance)}</div>
      <div className="account-meta">{n} transaction{n === 1 ? '' : 's'}</div>
    </article>
  );
}

export default function Accounts() {
  const { data: accounts, error, loading, reload } = useApi(accountsApi.list);
  const { notify } = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function confirmDelete() {
    const name = deleting.name;
    await accountsApi.remove(deleting.id, { cascade: deleting.transactionCount > 0 });
    setDeleting(null);
    notify(`${name} deleted`);
    reload();
  }

  const total = accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0;
  const assets = accounts?.reduce((sum, a) => sum + Math.max(a.balance, 0), 0) ?? 0;
  const liabilities = accounts?.reduce((sum, a) => sum + Math.max(-a.balance, 0), 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="page-sub">Balances are calculated from each account’s transactions</p>
        </div>
        <button className="btn" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} />
          Add account
        </button>
      </div>

      <Status loading={loading && !accounts} error={error} onRetry={reload} />

      {accounts && accounts.length === 0 && (
        <div className="card">
          <EmptyState icon="wallet">No accounts yet. Add one to start tracking.</EmptyState>
        </div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="stack">
          <section className="card net-worth">
            <div>
              <div className="stat-label">Net worth</div>
              <div className={`net-value ${total < 0 ? 'negative' : ''}`}>{formatMoney(total)}</div>
            </div>
            <div className="net-split">
              <div>
                <div className="stat-label">Assets</div>
                <strong>{formatMoney(assets)}</strong>
              </div>
              <div>
                <div className="stat-label">Liabilities</div>
                <strong className={liabilities > 0 ? 'negative' : ''}>{formatMoney(liabilities)}</strong>
              </div>
            </div>
          </section>

          <div className="account-grid">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add account' : 'Edit account'} onClose={() => setEditing(null)}>
          <AccountForm
            account={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              notify(editing === 'new' ? 'Account added' : 'Account updated');
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete account"
          message={deleteMessage(deleting)}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
