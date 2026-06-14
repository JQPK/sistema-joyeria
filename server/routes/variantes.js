const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET variants by product ID
router.get('/:productoId', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM producto_variantes WHERE producto_id = $1 AND activo = true ORDER BY nombre_variante ASC',
      [req.params.productoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST create variant
router.post('/', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      producto_id, sku, nombre_variante,
      atributo_1_nombre, atributo_1_valor,
      atributo_2_nombre, atributo_2_valor,
      precio_venta, precio_compra, stock_actual, stock_minimo,
      peso_gramos, imagen_path
    } = req.body;

    const finalSku = sku || `JM-VAR-${Math.floor(100000 + Math.random() * 900000)}`;

    const result = await client.query(`
      INSERT INTO producto_variantes (
        producto_id, sku, nombre_variante,
        atributo_1_nombre, atributo_1_valor,
        atributo_2_nombre, atributo_2_valor,
        precio_venta, precio_compra, stock_actual, stock_minimo,
        peso_gramos, imagen_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id
    `, [
      producto_id, finalSku, nombre_variante,
      atributo_1_nombre || '', atributo_1_valor || '',
      atributo_2_nombre || '', atributo_2_valor || '',
      precio_venta || null, precio_compra || null, stock_actual || 0, stock_minimo || 1,
      peso_gramos || 0, imagen_path || null
    ]);

    // Update parent product stock and flag
    await client.query(`
      UPDATE productos 
      SET tiene_variantes = TRUE,
          stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
      WHERE id = $1
    `, [producto_id]);

    await client.query('COMMIT');
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('product:updated', { id: producto_id });
      io.emit('stock:changed');
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT update variant
router.put('/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get product_id
    const varRes = await client.query('SELECT producto_id FROM producto_variantes WHERE id = $1', [req.params.id]);
    if (varRes.rows.length === 0) throw new Error('Variante no encontrada');
    const producto_id = varRes.rows[0].producto_id;

    const fields = [];
    const values = [];
    let paramIdx = 1;
    
    const allowed = ['sku', 'nombre_variante', 'atributo_1_nombre', 'atributo_1_valor', 
                     'atributo_2_nombre', 'atributo_2_valor', 'precio_venta', 'precio_compra', 
                     'stock_actual', 'stock_minimo', 'peso_gramos', 'imagen_path', 'activo'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(req.params.id);
      await client.query(`UPDATE producto_variantes SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
      
      // Update parent stock
      await client.query(`
        UPDATE productos 
        SET stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
        WHERE id = $1
      `, [producto_id]);
    }

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('product:updated', { id: producto_id });
      io.emit('stock:changed');
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE soft delete variant
router.delete('/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const varRes = await client.query('SELECT producto_id FROM producto_variantes WHERE id = $1', [req.params.id]);
    if (varRes.rows.length === 0) throw new Error('Variante no encontrada');
    const producto_id = varRes.rows[0].producto_id;

    await client.query('UPDATE producto_variantes SET activo = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
    
    // Check if parent still has variants
    const checkRes = await client.query('SELECT COUNT(*) as count FROM producto_variantes WHERE producto_id = $1 AND activo = true', [producto_id]);
    const count = parseInt(checkRes.rows[0].count);
    
    await client.query(`
      UPDATE productos 
      SET tiene_variantes = $2,
          stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
      WHERE id = $1
    `, [producto_id, count > 0]);

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('product:updated', { id: producto_id });
      io.emit('stock:changed');
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
