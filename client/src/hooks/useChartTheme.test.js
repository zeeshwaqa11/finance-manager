import { describe, expect, it } from 'vitest';
import { assignCategoryColors } from './useChartTheme.js';

const theme = {
  series: ['#s1', '#s2', '#s3', '#s4', '#s5', '#s6', '#s7', '#s8'],
  muted: '#muted',
};

const cat = (id, kind = 'expense') => ({ id, name: `c${id}`, kind });

describe('assignCategoryColors', () => {
  it('gives expense categories palette slots in id order', () => {
    const colors = assignCategoryColors([cat(3), cat(1), cat(2)], theme);
    expect(colors.get(1)).toBe('#s1');
    expect(colors.get(2)).toBe('#s2');
    expect(colors.get(3)).toBe('#s3');
  });

  it('keeps colors stable regardless of the input order', () => {
    const a = assignCategoryColors([cat(1), cat(2), cat(3)], theme);
    const b = assignCategoryColors([cat(3), cat(2), cat(1)], theme);
    for (const id of [1, 2, 3]) expect(a.get(id)).toBe(b.get(id));
  });

  it('skips income categories without consuming a slot', () => {
    const colors = assignCategoryColors([cat(1), cat(2, 'income'), cat(3)], theme);
    expect(colors.get(2)).toBe('#muted');
    expect(colors.get(3)).toBe('#s2');
  });

  it('counts categories of kind both as expense categories', () => {
    expect(assignCategoryColors([cat(1, 'both')], theme).get(1)).toBe('#s1');
  });

  it('never repeats a hue: extras beyond eight share the neutral color', () => {
    const many = Array.from({ length: 10 }, (_, i) => cat(i + 1));
    const colors = assignCategoryColors(many, theme);
    expect(colors.get(8)).toBe('#s8');
    expect(colors.get(9)).toBe('#muted');
    expect(colors.get(10)).toBe('#muted');
    const distinct = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((id) => colors.get(id)));
    expect(distinct.size).toBe(8);
  });

  it('handles an empty list', () => {
    expect(assignCategoryColors([], theme).size).toBe(0);
  });
});
