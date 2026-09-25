import { createApp } from './app.js';
import { db, dbPath, isNewDatabase } from './db/connection.js';
import { seedSampleData } from './db/seed.js';

if (isNewDatabase && process.env.SEED !== 'false') {
  seedSampleData(db);
  console.log('New database created and seeded with sample data.');
}

const port = Number(process.env.PORT) || 5000;
createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}  (database: ${dbPath})`);
});
