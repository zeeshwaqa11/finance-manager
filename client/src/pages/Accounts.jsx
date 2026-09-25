import { useState } from 'react';
import { accountsApi } from '../api/index.js';
import AccountForm from '../components/AccountForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import Status from '../components/Status.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatMoney } from '../utils/format.js';

function deleteMessage(account) {
  const n = account.transactionCount;
  if (!n) return `Delete "${account.name}"? This cannot be undone.`;
  return `Delete "${account.name}" and its ${n} transaction${n === 1 ? '' : 's'}? This cannot be undone.`;
}

export default function Accounts() {
  const { data: accounts, error, loading, reload } = useApi(accountsApi.list);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function confirmDelete() {
    await accountsApi.remove(deleting.id, { cascade: deleting.transactionCount > 0 });
    setDeleting(null);
    reload();
  }

  const total = accounts?.reduce((sum, a) => sum + a.balance, 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <h1>Accounts</h1>
        <button className="btn" onClick={() => setEditing('new')}>Add account</button>
      </div>

      <Status loading={loading && !accounts} error={error} onRetry={reload} />

      {accounts && (
        <div className="card">
          {accounts.length === 0 ? (
            <p className="empty">No accounts yet. Add one to start tracking.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="num">Transactions</th>
                    <th className="num">Balance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td className="muted">{a.type}</td>
                      <td className="num">{a.transactionCount}</td>
                      <td className={`num ${a.balance < 0 ? 'negative' : ''}`}>{formatMoney(a.balance)}</td>
                      <td className="actions">
                        <button className="btn-ghost" onClick={() => setEditing(a)}>Edit</button>
                        <button className="btn-ghost btn-danger" onClick={() => setDeleting(a)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Net worth</strong></td>
                    <td className={`num ${total < 0 ? 'negative' : ''}`}><strong>{formatMoney(total)}</strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Add account' : 'Edit account'} onClose={() => setEditing(null)}>
          <AccountForm
            account={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
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
