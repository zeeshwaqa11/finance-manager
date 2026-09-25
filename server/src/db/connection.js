import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const dbPath = process.env.DB_PATH ?? path.resolve(here, '../../data/finance.db');

const SCHEMA_VERSION = 1;

const STARTER_CATEGORIES = [
  ['Food', 'expense'],
  ['Rent', 'expense'],
  ['Transport', 'expense'],
  ['Utilities', 'expense'],
  ['Entertainment', 'expense'],
  ['Health', 'expense'],
  ['Shopping', 'expense'],
  ['Salary', 'income'],
  ['Other', 'both'],
];

export function applySchema(db) {
  if (db.pragma('user_version', { simple: true }) >= SCHEMA_VERSION) return false;

  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');

  db.transaction(() => {
    db.exec(schema);
    const insertCategory = db.prepare('INSERT INTO categories (name, kind) VALUES (?, ?)');
    for (const [name, kind] of STARTER_CATEGORIES) insertCategory.run(name, kind);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
  return true;
}

export function openDatabase(file = dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  const created = applySchema(db);
  return { db, created };
}

const { db, created } = openDatabase();
export { db, created as isNewDatabase };
