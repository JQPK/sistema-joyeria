const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetDB() {
  const client = await pool.connect();
  try {
    console.log('Iniciando el borrado de datos...');
    await client.query('BEGIN');

    // 1. Borrar todas las ventas y sus detalles
    console.log('Borrando ventas...');
    await client.query('TRUNCATE TABLE detalle_ventas CASCADE;');
    await client.query('TRUNCATE TABLE ventas CASCADE;');

    // 2. Borrar todos los movimientos de caja
    console.log('Borrando movimientos de caja...');
    await client.query('TRUNCATE TABLE movimientos_caja CASCADE;');

    // 3. Borrar productos y variantes
    console.log('Borrando productos...');
    await client.query('TRUNCATE TABLE producto_variantes CASCADE;');
    await client.query('TRUNCATE TABLE productos CASCADE;');

    // 4. (Opcional) Borrar categorías y materiales
    // Descomenta estas líneas si también quieres empezar sin categorías ni materiales
    // console.log('Borrando categorías y materiales...');
    // await client.query('TRUNCATE TABLE categorias CASCADE;');
    // await client.query('TRUNCATE TABLE materiales CASCADE;');

    // 5. Reiniciar los correlativos de facturas/boletas
    console.log('Reiniciando correlativos de empresa a 0...');
    await client.query(`
      UPDATE config_empresa 
      SET correlativo_boleta = 0, 
          correlativo_factura = 0;
    `);

    await client.query('COMMIT');
    console.log('✅ ¡Base de datos reiniciada con éxito! Ya está limpia y lista para producción.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al reiniciar la base de datos:', err);
  } finally {
    client.release();
    pool.end();
  }
}

resetDB();
