import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http, query } from './client.js';

function mockFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('query', () => {
  it('builds a query string and skips empty values', () => {
    expect(query({ a: 1, b: '', c: null, d: undefined, e: 'x y' })).toBe('?a=1&e=x+y');
  });

  it('keeps zero and returns an empty string when nothing is set', () => {
    expect(query({ n: 0 })).toBe('?n=0');
    expect(query({})).toBe('');
    expect(query({ a: '' })).toBe('');
  });
});

describe('http', () => {
  it('prefixes /api and returns parsed JSON', async () => {
    const fetchMock = mockFetch(json([{ id: 1 }]));
    await expect(http.get('/accounts')).resolves.toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/accounts', {
      method: 'GET',
      headers: undefined,
      body: undefined,
    });
  });

  it('sends a JSON body with a content type', async () => {
    const fetchMock = mockFetch(json({ id: 2 }, 201));
    await http.post('/accounts', { name: 'A' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(options.body).toBe('{"name":"A"}');
  });

  it('uses the right verb for put and delete', async () => {
    const fetchMock = mockFetch({ ok: true, status: 204 });
    await http.put('/x/1', { a: 1 });
    await http.delete('/x/1');
    expect(fetchMock.mock.calls.map(([, o]) => o.method)).toEqual(['PUT', 'DELETE']);
  });

  it('returns null for 204 responses', async () => {
    mockFetch({ ok: true, status: 204 });
    await expect(http.delete('/accounts/1')).resolves.toBeNull();
  });

  it('throws an ApiError carrying the server message and status', async () => {
    mockFetch(json({ error: 'Account not found' }, 404));
    const error = await http.get('/accounts/9').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Account not found');
    expect(error.status).toBe(404);
  });

  it('falls back to a generic message when the error body is not JSON', async () => {
    mockFetch({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
    await expect(http.get('/x')).rejects.toMatchObject({ message: 'Request failed (502)', status: 502 });
  });

  it('explains when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(http.get('/x')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('backend') });
  });
});
