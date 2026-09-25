import { Router } from 'express';
import { requireId, requireMoney, requireString } from '../middleware/validate.js';
import * as accounts from '../services/accounts.js';

const router = Router();

function parseBody(body = {}) {
  return {
    name: requireString(body.name, 'name'),
    type: requireString(body.type, 'type', { max: 50 }),
    openingBalanceCents: requireMoney(body.openingBalance ?? 0, 'openingBalance', {
      allowNegative: true,
      allowZero: true,
    }),
  };
}

router.get('/', (req, res) => res.json(accounts.listAccounts()));

router.get('/:id', (req, res) => res.json(accounts.getAccount(requireId(req.params.id, 'id'))));

router.post('/', (req, res) => res.status(201).json(accounts.createAccount(parseBody(req.body))));

router.put('/:id', (req, res) =>
  res.json(accounts.updateAccount(requireId(req.params.id, 'id'), parseBody(req.body))),
);

router.delete('/:id', (req, res) => {
  accounts.deleteAccount(requireId(req.params.id, 'id'), { cascade: req.query.cascade === 'true' });
  res.status(204).end();
});

export default router;
