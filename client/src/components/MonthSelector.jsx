import { addMonths, currentMonth, formatMonth } from '../utils/format.js';

export default function MonthSelector({ month, onChange }) {
  const now = currentMonth();
  const options = Array.from({ length: 31 }, (_, i) => addMonths(now, 6 - i));
  if (!options.includes(month)) options.push(month);

  return (
    <div className="month-selector">
      <button type="button" onClick={() => onChange(addMonths(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <select value={month} onChange={(e) => onChange(e.target.value)} aria-label="Month">
        {options.map((m) => (
          <option key={m} value={m}>
            {formatMonth(m)}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onChange(addMonths(month, 1))} aria-label="Next month">
        ›
      </button>
      {month !== now && (
        <button type="button" className="btn-link" onClick={() => onChange(now)}>
          This month
        </button>
      )}
    </div>
  );
}
