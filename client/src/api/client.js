export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const RETRY_DELAY = 300;

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(method, path, body) {
  const attempts = method === 'GET' ? 2 : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`/api${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!RETRYABLE_STATUSES.has(res.status) || attempt === attempts) return res;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    }
    await delay(RETRY_DELAY);
  }
  throw lastError;
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetchWithRetry(method, path, body);
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running on port 5000?', 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export function query(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const http = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
