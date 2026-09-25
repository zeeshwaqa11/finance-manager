import { Router } from 'express';
import { requireEnum, requireId, requireString } from '../middleware/validate.js';
import * as categories from '../services/categories.js';

const router = Router();

function parseBody(body = {}) {
  return {
    name: requireString(body.name, 'name', { max: 50 }),
    kind: requireEnum(body.kind ?? 'expense', 'kind', ['income', 'expense', 'both']),
  };
}

router.get('/', (req, res) => res.json(categories.listCategories()));

router.post('/', (req, res) => res.status(201).json(categories.createCategory(parseBody(req.body))));

router.put('/:id', (req, res) =>
  res.json(categories.updateCategory(requireId(req.params.id, 'id'), parseBody(req.body))),
);

router.delete('/:id', (req, res) => {
  categories.deleteCategory(requireId(req.params.id, 'id'));
  res.status(204).end();
});

export default router;
