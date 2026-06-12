const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const { parse } = require('csv-parse');
const upload = multer({ storage: multer.memoryStorage() });

router.use(auth);

// GET all with filters
router.get('/', async (req, res, next) => {
  try {
    let query = `
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.query.categoria_id) {
      query += ` AND p.categoria_id = $${paramIndex++}`;
      params.push(req.query.categoria_id);
    }
    if (req.query.material_id) {
      query += ` AND p.material_id = $${paramIndex++}`;
      params.push(req.query.material_id);
    }
    if (req.query.stock_bajo === 'true') {
      query += ` AND p.stock_actual <= p.stock_minimo`;
    }
    if (req.query.precio_min) {
      query += ` AND p.precio_venta >= $${paramIndex++}`;
      params.push(req.query.precio_min);
    }
    if (req.query.precio_max) {
      query += ` AND p.precio_venta <= $${paramIndex++}`;
      params.push(req.query.precio_max);
    }
    if (req.query.estado) {
      query += ` AND p.activo = $${paramIndex++}`;
      params.push(req.query.estado === 'activo');
    } else {
      query += ` AND p.activo = true`;
    }

    query += ' ORDER BY p.nombre ASC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET search
router.get('/search', async (req, res, next) => {
  try {
    const term = `%${req.query.q || ''}%`;
    const result = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.activo = true 
        AND (p.nombre ILIKE $1 OR p.codigo ILIKE $1 OR c.nombre ILIKE $1)
      ORDER BY p.nombre ASC LIMIT 50
    `, [term]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET by id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      codigo, nombre, descripcion, categoria_id, material_id, 
      peso_gramos, precio_compra, precio_venta, stock_actual, stock_minimo, 
      descuento_porcentaje, imagen_path 
    } = req.body;

    const result = await client.query(`
      INSERT INTO productos (
        codigo, nombre, descripcion, categoria_id, material_id,
        peso_gramos, precio_compra, precio_venta, stock_actual, stock_minimo,
        descuento_porcentaje, imagen_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [
      codigo || null, nombre, descripcion || '', categoria_id || null, material_id || null,
      peso_gramos || 0, precio_compra || 0, precio_venta, stock_actual || 0, stock_minimo || 1,
      descuento_porcentaje || 0, imagen_path || null
    ]);

    const newId = result.rows[0].id;

    if (!codigo) {
      let prefix = 'PROD';
      if (categoria_id) {
        const catRes = await client.query('SELECT nombre FROM categorias WHERE id = $1', [categoria_id]);
        if (catRes.rows.length > 0) prefix = catRes.rows[0].nombre.substring(0, 3).toUpperCase();
      }
      const newCodigo = `${prefix}-${String(newId).padStart(4, '0')}`;
      await client.query('UPDATE productos SET codigo = $1 WHERE id = $2', [newCodigo, newId]);
    }

    await client.query('COMMIT');
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.emit('product:created', { id: newId });

    res.json({ success: true, id: newId });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT update
router.put('/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // Check price change
    if (req.body.precio_venta !== undefined) {
      const currentRes = await client.query('SELECT precio_venta FROM productos WHERE id = $1', [id]);
      if (currentRes.rows.length > 0) {
        const currentPrice = parseFloat(currentRes.rows[0].precio_venta);
        const newPrice = parseFloat(req.body.precio_venta);
        if (currentPrice !== newPrice) {
          await client.query(
            'INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo) VALUES ($1, $2, $3)',
            [id, currentPrice, newPrice]
          );
        }
      }
    }

    const fields = [];
    const values = [];
    let paramIdx = 1;
    
    const allowed = ['codigo', 'nombre', 'descripcion', 'categoria_id', 'material_id',
      'peso_gramos', 'precio_compra', 'precio_venta', 'stock_actual', 'stock_minimo',
      'descuento_porcentaje', 'imagen_path', 'activo'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      await client.query(`UPDATE productos SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    }

    await client.query('COMMIT');
    
    // Emit real-time event
    const io = req.app.get('io');
    if (io) io.emit('product:updated', { id });

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE soft
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE productos SET activo = false, updated_at = NOW() WHERE id = $1', [id]);
    
    const io = req.app.get('io');
    if (io) io.emit('product:deleted', { id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST import CSV
router.post('/import-csv', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  parse(req.file.buffer, { columns: true, skip_empty_lines: true }, async (err, records) => {
    if (err) return res.status(400).json({ success: false, message: 'Error parsing CSV' });
    
    // Minimal implementation for now - full implementation requires category/material resolution
    res.json({ success: true, message: 'CSV parsed', count: records.length });
  });
});

module.exports = router;
