import { describe, expect, it } from 'vitest';
import { addMonths, currentMonth, formatDate, formatMoney, formatMonth, todayISO } from './format.js';

describe('formatMoney', () => {
  it('formats dollars with separators and two decimals', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(1000000)).toBe('$1,000,000.00');
  });

  it('formats negatives with a minus sign', () => {
    expect(formatMoney(-1623.35)).toBe('-$1,623.35');
  });
});

describe('addMonths', () => {
  it('moves forward and backward across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-05', 0)).toBe('2026-05');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
  });
});

describe('formatMonth', () => {
  it('gives long and short names', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
    expect(formatMonth('2026-01', { short: true })).toBe('Jan');
  });
});

describe('formatDate', () => {
  it('formats an ISO date without timezone shifting', () => {
    expect(formatDate('2026-09-01')).toBe('Sep 1, 2026');
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });
});

describe('todayISO and currentMonth', () => {
  it('produce matching zero-padded values', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
    expect(todayISO().startsWith(currentMonth())).toBe(true);
  });
});
