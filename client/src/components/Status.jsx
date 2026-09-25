export default function Status({ loading, error, onRetry }) {
  if (error) {
    return (
      <div className="notice notice-error" role="alert">
        {error.message}
        {onRetry && (
          <button type="button" className="btn-link" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }
  if (loading) return <p className="muted">Loading…</p>;
  return null;
}
