const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function initializeDatabase() {
  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSql);
    
    // Execute variants schema
    const variantsPath = path.join(__dirname, '../migrations/002_variantes.sql');
    const variantsSql = fs.readFileSync(variantsPath, 'utf8');
    await db.query(variantsSql);
    
    console.log('Database schema initialized.');

    // Read and execute seeds
    const seedsPath = path.join(__dirname, '../seeds/initial_data.sql');
    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    await db.query(seedsSql);
    console.log('Database seeded with defaults.');
    
    // Add variante_id to detalle_ventas if it doesn't exist
    try {
      await db.query(`ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL;`);
    } catch(e) {
      console.log('variante_id already exists or error', e.message);
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  }
}

module.exports = { initializeDatabase };
