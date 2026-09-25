import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import accountsRouter from './routes/accounts.js';
import budgetsRouter from './routes/budgets.js';
import categoriesRouter from './routes/categories.js';
import reportsRouter from './routes/reports.js';
import transactionsRouter from './routes/transactions.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
