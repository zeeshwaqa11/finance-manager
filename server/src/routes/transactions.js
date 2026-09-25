import { Router } from 'express';
import {
  optionalString,
  requireDate,
  requireEnum,
  requireId,
  requireMoney,
} from '../middleware/validate.js';
import * as transactions from '../services/transactions.js';

const router = Router();

const TYPES = ['income', 'expense'];

function parseBody(body = {}) {
  return {
    accountId: requireId(body.accountId, 'accountId'),
    categoryId: requireId(body.categoryId, 'categoryId'),
    amountCents: requireMoney(body.amount, 'amount'),
    type: requireEnum(body.type, 'type', TYPES),
    date: requireDate(body.date, 'date'),
    note: optionalString(body.note, 'note'),
  };
}

router.get('/', (req, res) => {
  const q = req.query;
  res.json(
    transactions.listTransactions({
      accountId: q.accountId ? requireId(q.accountId, 'accountId') : undefined,
      categoryId: q.categoryId ? requireId(q.categoryId, 'categoryId') : undefined,
      type: q.type ? requireEnum(q.type, 'type', TYPES) : undefined,
      from: q.from ? requireDate(q.from, 'from') : undefined,
      to: q.to ? requireDate(q.to, 'to') : undefined,
      sort: q.sort,
      order: q.order ? requireEnum(q.order, 'order', ['asc', 'desc']) : undefined,
    }),
  );
});

router.get('/:id', (req, res) => res.json(transactions.getTransaction(requireId(req.params.id, 'id'))));

router.post('/', (req, res) => res.status(201).json(transactions.createTransaction(parseBody(req.body))));

router.put('/:id', (req, res) =>
  res.json(transactions.updateTransaction(requireId(req.params.id, 'id'), parseBody(req.body))),
);

router.delete('/:id', (req, res) => {
  transactions.deleteTransaction(requireId(req.params.id, 'id'));
  res.status(204).end();
});

export default router;
