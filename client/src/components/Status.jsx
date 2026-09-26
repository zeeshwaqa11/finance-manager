import Icon from './Icon.jsx';

export default function Status({ loading, error, onRetry }) {
  if (error) {
    return (
      <div className="notice notice-error" role="alert">
        <Icon name="alert" size={18} />
        <span>{error.message}</span>
        {onRetry && (
          <button type="button" className="btn-link" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }
  return null;
}
