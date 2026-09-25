import { Router } from 'express';
import { badRequest, requireMonth } from '../middleware/validate.js';
import { currentMonth } from '../utils/dates.js';
import * as reports from '../services/reports.js';

const router = Router();

router.get('/summary', (req, res) => {
  const month = req.query.month ? requireMonth(req.query.month, 'month') : currentMonth();
  res.json(reports.monthlySummary(month));
});

router.get('/trend', (req, res) => {
  const end = req.query.end ? requireMonth(req.query.end, 'end') : currentMonth();
  const months = req.query.months ? Number(req.query.months) : 6;
  if (!Number.isInteger(months) || months < 1 || months > 36) throw badRequest('months must be between 1 and 36');
  res.json(reports.spendingTrend(end, months));
});

export default router;
