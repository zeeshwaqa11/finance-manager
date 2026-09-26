import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useChartTheme } from './useChartTheme.js';

const root = document.documentElement;

beforeEach(() => {
  root.style.setProperty('--ink', '#111111');
  root.style.setProperty('--ink-2', '#222222');
  root.style.setProperty('--muted', '#333333');
  root.style.setProperty('--grid', '#444444');
  root.style.setProperty('--surface', '#555555');
  for (let i = 1; i <= 8; i++) root.style.setProperty(`--series-${i}`, `#00000${i}`);
});

afterEach(() => {
  root.removeAttribute('style');
  delete root.dataset.theme;
});

describe('useChartTheme', () => {
  it('resolves the theme variables into concrete colors', () => {
    const { result } = renderHook(() => useChartTheme());
    expect(result.current.ink).toBe('#111111');
    expect(result.current.ink2).toBe('#222222');
    expect(result.current.muted).toBe('#333333');
    expect(result.current.grid).toBe('#444444');
    expect(result.current.surface).toBe('#555555');
    expect(result.current.series).toHaveLength(8);
    expect(result.current.series[0]).toBe('#000001');
    expect(result.current.series[7]).toBe('#000008');
  });

  it('re-reads the colors when the theme attribute changes', async () => {
    const { result } = renderHook(() => useChartTheme());
    expect(result.current.ink).toBe('#111111');

    root.style.setProperty('--ink', '#eeeeee');
    root.dataset.theme = 'dark';
    await waitFor(() => expect(result.current.ink).toBe('#eeeeee'));
  });

  it('stops observing after unmount', async () => {
    const { result, unmount } = renderHook(() => useChartTheme());
    unmount();
    root.style.setProperty('--ink', '#abcdef');
    root.dataset.theme = 'light';
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.ink).toBe('#111111');
  });
});
