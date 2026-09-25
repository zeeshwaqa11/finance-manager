import { db } from '../db/connection.js';
import { conflict, notFound } from '../middleware/validate.js';

export function listCategories() {
  return db.prepare('SELECT id, name, kind FROM categories ORDER BY name').all();
}

export function getCategory(id) {
  const row = db.prepare('SELECT id, name, kind FROM categories WHERE id = ?').get(id);
  if (!row) throw notFound('Category');
  return row;
}

export function createCategory({ name, kind }) {
  const { lastInsertRowid } = db.prepare('INSERT INTO categories (name, kind) VALUES (?, ?)').run(name, kind);
  return getCategory(lastInsertRowid);
}

export function updateCategory(id, { name, kind }) {
  const { changes } = db.prepare('UPDATE categories SET name = ?, kind = ? WHERE id = ?').run(name, kind, id);
  if (!changes) throw notFound('Category');
  return getCategory(id);
}

export function deleteCategory(id) {
  getCategory(id);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?').get(id);
  if (n > 0) throw conflict(`Category is used by ${n} transaction(s) and cannot be deleted`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}
