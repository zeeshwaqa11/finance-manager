import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApi } from './useApi.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApi', () => {
  it('starts loading and then exposes the data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: 1 });
    const { result } = renderHook(() => useApi(fetcher));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ok: 1 });
    expect(result.current.error).toBeNull();
  });

  it('exposes the error and no data when the request fails', async () => {
    const failure = new Error('boom');
    const { result } = renderHook(() => useApi(() => Promise.reject(failure)));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeNull();
  });

  it('refetches when reload is called, keeping the current data meanwhile', async () => {
    const second = deferred();
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => result.current.reload());
    expect(result.current.data).toBe('first');
    expect(result.current.loading).toBe(true);

    await act(async () => second.resolve('second'));
    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refetches when dependencies change and hides the old data by default', async () => {
    const next = deferred();
    const fetcher = vi.fn((month) => (month === 'a' ? Promise.resolve('data-a') : next.promise));
    const { result, rerender } = renderHook(({ month }) => useApi(() => fetcher(month), [month]), {
      initialProps: { month: 'a' },
    });
    await waitFor(() => expect(result.current.data).toBe('data-a'));

    rerender({ month: 'b' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => next.resolve('data-b'));
    await waitFor(() => expect(result.current.data).toBe('data-b'));
  });

  it('keeps the previous data while loading when keepPrevious is set', async () => {
    const next = deferred();
    const fetcher = vi.fn((month) => (month === 'a' ? Promise.resolve('data-a') : next.promise));
    const { result, rerender } = renderHook(
      ({ month }) => useApi(() => fetcher(month), [month], { keepPrevious: true }),
      { initialProps: { month: 'a' } },
    );
    await waitFor(() => expect(result.current.data).toBe('data-a'));

    rerender({ month: 'b' });
    expect(result.current.data).toBe('data-a');
    expect(result.current.loading).toBe(true);

    await act(async () => next.resolve('data-b'));
    await waitFor(() => expect(result.current.data).toBe('data-b'));
  });

  it('ignores a slow response that arrives after the dependencies changed', async () => {
    const slow = deferred();
    const fast = deferred();
    const fetcher = vi.fn((month) => (month === 'a' ? slow.promise : fast.promise));
    const { result, rerender } = renderHook(({ month }) => useApi(() => fetcher(month), [month]), {
      initialProps: { month: 'a' },
    });

    rerender({ month: 'b' });
    await act(async () => fast.resolve('data-b'));
    await waitFor(() => expect(result.current.data).toBe('data-b'));

    await act(async () => slow.resolve('data-a'));
    expect(result.current.data).toBe('data-b');
  });

  it('does not refetch when re-rendered with equal dependencies', async () => {
    const fetcher = vi.fn().mockResolvedValue('x');
    const { result, rerender } = renderHook(({ filters }) => useApi(fetcher, [filters]), {
      initialProps: { filters: { a: 1 } },
    });
    await waitFor(() => expect(result.current.data).toBe('x'));
    rerender({ filters: { a: 1 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears the error when a later request succeeds', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('first fails')).mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useApi(fetcher));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });
});
