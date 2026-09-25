import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fromCents, toCents } from '../src/utils/money.js';

describe('money', () => {
  it('converts dollars to integer cents', () => {
    assert.equal(toCents(19.99), 1999);
    assert.equal(toCents(0), 0);
    assert.equal(toCents(-5.5), -550);
  });

  it('rounds away floating-point error', () => {
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(1.15), 115);
    assert.equal(toCents(8.2), 820);
  });

  it('converts cents back to dollars', () => {
    assert.equal(fromCents(1999), 19.99);
    assert.equal(fromCents(-550), -5.5);
    assert.equal(fromCents(0), 0);
  });

  it('round-trips two-decimal amounts', () => {
    for (const amount of [0.01, 0.99, 12.34, 1234567.89]) {
      assert.equal(fromCents(toCents(amount)), amount);
    }
  });
});
