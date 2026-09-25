import { Router } from 'express';
import { requireId, requireMonth, requireMoney } from '../middleware/validate.js';
import { currentMonth } from '../utils/dates.js';
import * as budgets from '../services/budgets.js';

const router = Router();

router.get('/', (req, res) => {
  const month = req.query.month ? requireMonth(req.query.month, 'month') : currentMonth();
  res.json(budgets.listBudgets(month));
});

router.post('/', (req, res) => {
  const body = req.body ?? {};
  const created = budgets.createBudget({
    categoryId: requireId(body.categoryId, 'categoryId'),
    month: requireMonth(body.month, 'month'),
    amountCents: requireMoney(body.amount, 'amount'),
  });
  res.status(201).json(created);
});

router.put('/:id', (req, res) =>
  res.json(
    budgets.updateBudget(requireId(req.params.id, 'id'), {
      amountCents: requireMoney((req.body ?? {}).amount, 'amount'),
    }),
  ),
);

router.delete('/:id', (req, res) => {
  budgets.deleteBudget(requireId(req.params.id, 'id'));
  res.status(204).end();
});

export default router;
