import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addMonths,
  currentMonth,
  isValidDate,
  isValidMonth,
  monthBounds,
  todayISO,
} from '../src/utils/dates.js';

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    for (const d of ['2026-01-01', '2026-12-31', '2024-02-29']) assert.equal(isValidDate(d), true, d);
  });

  it('rejects impossible dates', () => {
    for (const d of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-04-31']) {
      assert.equal(isValidDate(d), false, d);
    }
  });

  it('rejects malformed values', () => {
    for (const d of ['01/02/2026', '2026-1-1', '2026-01-01T00:00', '', null, undefined, 20260101]) {
      assert.equal(isValidDate(d), false, String(d));
    }
  });
});

describe('isValidMonth', () => {
  it('accepts YYYY-MM only', () => {
    assert.equal(isValidMonth('2026-09'), true);
    assert.equal(isValidMonth('2026-12'), true);
    for (const m of ['2026-13', '2026-00', '2026-9', '2026-09-01', '', null]) {
      assert.equal(isValidMonth(m), false, String(m));
    }
  });
});

describe('addMonths', () => {
  it('moves within a year', () => {
    assert.equal(addMonths('2026-05', 1), '2026-06');
    assert.equal(addMonths('2026-05', -2), '2026-03');
    assert.equal(addMonths('2026-05', 0), '2026-05');
  });

  it('crosses year boundaries in both directions', () => {
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonths('2026-12', 1), '2027-01');
    assert.equal(addMonths('2026-11', 3), '2027-02');
    assert.equal(addMonths('2026-03', -15), '2024-12');
  });
});

describe('monthBounds', () => {
  it('spans the whole month for string comparison', () => {
    assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-31' });
    assert.ok('2026-02-28' >= '2026-02-01' && '2026-02-28' <= '2026-02-31');
    assert.ok('2026-03-01' > '2026-02-31');
    assert.ok('2026-01-31' < '2026-02-01');
  });
});

describe('current date helpers', () => {
  it('currentMonth and todayISO are consistent and valid', () => {
    assert.equal(isValidMonth(currentMonth()), true);
    assert.equal(isValidDate(todayISO()), true);
    assert.equal(todayISO().slice(0, 7), currentMonth());
  });
});
