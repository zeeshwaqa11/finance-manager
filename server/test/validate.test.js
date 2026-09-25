import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HttpError,
  optionalString,
  requireDate,
  requireEnum,
  requireId,
  requireMoney,
  requireMonth,
  requireString,
  translateUnique,
} from '../src/middleware/validate.js';

const rejects400 = (fn) =>
  assert.throws(fn, (err) => err instanceof HttpError && err.status === 400);

describe('HttpError', () => {
  it('carries a status and message', () => {
    const err = new HttpError(418, 'teapot');
    assert.equal(err.status, 418);
    assert.equal(err.message, 'teapot');
    assert.ok(err instanceof Error);
  });
});

describe('requireId', () => {
  it('accepts positive integers and digit strings', () => {
    assert.equal(requireId(5, 'id'), 5);
    assert.equal(requireId('42', 'id'), 42);
  });

  it('rejects everything else', () => {
    for (const bad of [0, -1, 1.5, '0', '-3', '1.5', '1e3', '0x10', '', ' 5', 'abc', true, false, null, undefined, [], [1], {}, NaN, Infinity]) {
      rejects400(() => requireId(bad, 'id'));
    }
  });

  it('rejects integers beyond the safe range', () => {
    rejects400(() => requireId('99999999999999999999', 'id'));
  });
});

describe('requireString', () => {
  it('trims and returns the value', () => {
    assert.equal(requireString('  Food  ', 'name'), 'Food');
  });

  it('rejects blank, non-string and over-long values', () => {
    for (const bad of ['', '   ', null, undefined, 5, {}]) rejects400(() => requireString(bad, 'name'));
    rejects400(() => requireString('x'.repeat(101), 'name'));
    assert.equal(requireString('x'.repeat(100), 'name').length, 100);
    rejects400(() => requireString('abcd', 'name', { max: 3 }));
  });
});

describe('optionalString', () => {
  it('turns empty values into null', () => {
    for (const empty of [undefined, null, '', '   ']) assert.equal(optionalString(empty, 'note'), null);
  });

  it('trims real values and rejects bad ones', () => {
    assert.equal(optionalString(' hi ', 'note'), 'hi');
    rejects400(() => optionalString(5, 'note'));
    rejects400(() => optionalString('x'.repeat(501), 'note'));
  });
});

describe('requireEnum', () => {
  it('accepts listed values only', () => {
    assert.equal(requireEnum('income', 'type', ['income', 'expense']), 'income');
    rejects400(() => requireEnum('refund', 'type', ['income', 'expense']));
    rejects400(() => requireEnum(undefined, 'type', ['income', 'expense']));
  });
});

describe('requireDate and requireMonth', () => {
  it('validate format and calendar correctness', () => {
    assert.equal(requireDate('2026-09-25', 'date'), '2026-09-25');
    rejects400(() => requireDate('2026-02-30', 'date'));
    assert.equal(requireMonth('2026-09', 'month'), '2026-09');
    rejects400(() => requireMonth('2026-13', 'month'));
  });
});

describe('requireMoney', () => {
  it('parses numbers and decimal strings into cents', () => {
    assert.equal(requireMoney(12.34, 'amount'), 1234);
    assert.equal(requireMoney('12.34', 'amount'), 1234);
    assert.equal(requireMoney('7', 'amount'), 700);
    assert.equal(requireMoney(0.1 + 0.2 - 0.2, 'amount', { allowZero: false }), 10);
  });

  it('rejects malformed input', () => {
    for (const bad of ['abc', '0x10', '1e2', '', '  ', '1.', '.5', null, undefined, true, {}, [], NaN, Infinity]) {
      rejects400(() => requireMoney(bad, 'amount'));
    }
  });

  it('rejects more than two decimal places', () => {
    rejects400(() => requireMoney(1.999, 'amount'));
    rejects400(() => requireMoney('1.005', 'amount'));
  });

  it('enforces the sign and zero options', () => {
    rejects400(() => requireMoney(0, 'amount'));
    rejects400(() => requireMoney(-5, 'amount'));
    assert.equal(requireMoney(0, 'amount', { allowZero: true }), 0);
    assert.equal(requireMoney(-5, 'amount', { allowNegative: true }), -500);
    assert.equal(requireMoney('-5.25', 'amount', { allowNegative: true }), -525);
  });

  it('rejects absurdly large amounts', () => {
    rejects400(() => requireMoney(1e10, 'amount'));
  });
});

describe('translateUnique', () => {
  it('turns a unique-constraint error into a 409', () => {
    const translated = translateUnique({ code: 'SQLITE_CONSTRAINT_UNIQUE' }, 'already exists');
    assert.ok(translated instanceof HttpError);
    assert.equal(translated.status, 409);
    assert.equal(translated.message, 'already exists');
  });

  it('returns other errors untouched', () => {
    const other = new Error('boom');
    assert.equal(translateUnique(other, 'x'), other);
  });
});
