import { http, query } from './client.js';

export const accountsApi = {
  list: () => http.get('/accounts'),
  create: (data) => http.post('/accounts', data),
  update: (id, data) => http.put(`/accounts/${id}`, data),
  remove: (id, { cascade = false } = {}) => http.delete(`/accounts/${id}${cascade ? '?cascade=true' : ''}`),
};

export const categoriesApi = {
  list: () => http.get('/categories'),
};

export const transactionsApi = {
  list: (filters) => http.get(`/transactions${query(filters)}`),
  create: (data) => http.post('/transactions', data),
  update: (id, data) => http.put(`/transactions/${id}`, data),
  remove: (id) => http.delete(`/transactions/${id}`),
};

export const budgetsApi = {
  list: (month) => http.get(`/budgets${query({ month })}`),
  create: (data) => http.post('/budgets', data),
  update: (id, amount) => http.put(`/budgets/${id}`, { amount }),
  remove: (id) => http.delete(`/budgets/${id}`),
};

export const reportsApi = {
  summary: (month) => http.get(`/reports/summary${query({ month })}`),
  trend: (end, months = 6) => http.get(`/reports/trend${query({ end, months })}`),
};
