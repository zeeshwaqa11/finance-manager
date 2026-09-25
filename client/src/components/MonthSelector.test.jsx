import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addMonths, currentMonth } from '../utils/format.js';
import MonthSelector from './MonthSelector.jsx';

describe('MonthSelector', () => {
  it('steps to the previous and next month', async () => {
    const onChange = vi.fn();
    render(<MonthSelector month="2026-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenNthCalledWith(1, '2025-12');
    expect(onChange).toHaveBeenNthCalledWith(2, '2026-02');
  });

  it('reports a month picked from the dropdown', async () => {
    const onChange = vi.fn();
    const now = currentMonth();
    render(<MonthSelector month={now} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Month' }), addMonths(now, -3));
    expect(onChange).toHaveBeenCalledWith(addMonths(now, -3));
  });

  it('lists two years back through six months ahead', () => {
    const now = currentMonth();
    render(<MonthSelector month={now} onChange={() => {}} />);
    const values = screen.getAllByRole('option').map((o) => o.value);
    expect(values).toHaveLength(31);
    expect(values[0]).toBe(addMonths(now, 6));
    expect(values.at(-1)).toBe(addMonths(now, -24));
  });

  it('still shows a selected month outside the dropdown window', () => {
    render(<MonthSelector month="1999-05" onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveValue('1999-05');
  });

  it('offers a way back to this month only when elsewhere', async () => {
    const onChange = vi.fn();
    const now = currentMonth();
    const { rerender } = render(<MonthSelector month={now} onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument();

    rerender(<MonthSelector month={addMonths(now, -2)} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(onChange).toHaveBeenCalledWith(now);
  });
});
