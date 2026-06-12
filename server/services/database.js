const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function initializeDatabase() {
  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    console.log('Database schema initialized.');

    // Read and execute seeds
    const seedsPath = path.join(__dirname, '../seeds/initial_data.sql');
    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    await db.query(seedsSql);
    console.log('Database seeded with defaults.');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

module.exports = { initializeDatabase };
