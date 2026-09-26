import Icon from './Icon.jsx';

export default function EmptyState({ icon = 'receipt', children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <p>{children}</p>
    </div>
  );
}
