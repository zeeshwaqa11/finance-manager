import { isValidDate, isValidMonth } from '../utils/dates.js';
import { toCents } from '../utils/money.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const notFound = (what) => new HttpError(404, `${what} not found`);
export const conflict = (message) => new HttpError(409, message);

export function requireId(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${field} must be a positive integer`);
  return n;
}

export function requireString(value, field, { max = 100 } = {}) {
  if (typeof value !== 'string' || value.trim() === '') throw badRequest(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return trimmed;
}

export function optionalString(value, field, { max = 500 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return trimmed || null;
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function requireDate(value, field) {
  if (!isValidDate(value)) throw badRequest(`${field} must be a valid date in YYYY-MM-DD format`);
  return value;
}

export function requireMonth(value, field) {
  if (!isValidMonth(value)) throw badRequest(`${field} must be in YYYY-MM format`);
  return value;
}

export function requireMoney(value, field, { allowNegative = false, allowZero = false } = {}) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest(`${field} must be a number`);
  const cents = toCents(n);
  if (Math.abs(n * 100 - cents) > 1e-6) throw badRequest(`${field} can have at most 2 decimal places`);
  if (Math.abs(n) > 1e9) throw badRequest(`${field} is too large`);
  if (!allowNegative && cents < 0) throw badRequest(`${field} cannot be negative`);
  if (!allowZero && cents === 0) throw badRequest(`${field} must be greater than zero`);
  return cents;
}
