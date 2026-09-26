import { useState } from 'react';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      {error && (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}
      <div className="confirm-body">
        <span className="tile tile-danger">
          <Icon name="alert" />
        </span>
        <p className="confirm-message">{message}</p>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-delete" onClick={confirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
