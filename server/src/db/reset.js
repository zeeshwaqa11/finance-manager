import { applySchema, db, dbPath } from './connection.js';
import { seedSampleData } from './seed.js';

const empty = process.argv.includes('--empty');

db.transaction(() => {
  for (const table of ['transactions', 'budgets', 'accounts', 'categories']) {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  }
  db.pragma('user_version = 0');
})();

applySchema(db);
if (!empty) seedSampleData(db);

console.log(`Database reset (${dbPath}) ${empty ? 'with no sample data.' : 'with sample data.'}`);
