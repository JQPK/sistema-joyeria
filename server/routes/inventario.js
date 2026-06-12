const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET stats
router.get('/stats', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_productos,
        COALESCE(SUM(stock_actual), 0) as total_unidades,
        COALESCE(SUM(stock_actual * precio_compra), 0) as valor_compra,
        COALESCE(SUM(stock_actual * precio_venta), 0) as valor_venta
      FROM productos WHERE activo = true
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET top-selling
router.get('/top-selling', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    let query = `
      SELECT p.id, p.nombre, p.codigo, p.stock_actual, SUM(dv.cantidad) as total_vendido
      FROM productos p
      JOIN detalle_ventas dv ON p.id = dv.producto_id
      JOIN ventas v ON dv.venta_id = v.id
      WHERE v.estado = 'completada'
    `;
    const params = [];
    
    if (req.query.fechaInicio && req.query.fechaFin) {
      query += ` AND v.fecha >= $1 AND v.fecha <= $2`;
      params.push(req.query.fechaInicio, req.query.fechaFin + ' 23:59:59');
    }
    
    query += ` GROUP BY p.id ORDER BY total_vendido DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET low-rotation
router.get('/low-rotation', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const days = parseInt(req.query.days, 10) || 90;
    
    const result = await db.query(`
      SELECT p.id, p.nombre, p.codigo, p.stock_actual, COALESCE(SUM(dv.cantidad), 0) as total_vendido
      FROM productos p
      LEFT JOIN detalle_ventas dv ON p.id = dv.producto_id
      LEFT JOIN ventas v ON dv.venta_id = v.id AND v.estado = 'completada'
        AND v.fecha >= NOW() - INTERVAL '${days} days'
      WHERE p.activo = true
      GROUP BY p.id ORDER BY total_vendido ASC LIMIT $1
    `, [limit]);
    
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
