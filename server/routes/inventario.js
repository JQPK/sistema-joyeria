const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET stats
router.get('/stats', async (req, res, next) => {
  try {
    const sucursal_id = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? req.query.sucursal_id : null;
    let query;
    let params = [];

    if (sucursal_id) {
      query = `
        SELECT 
          COUNT(DISTINCT p.id) as total_productos,
          COALESCE(SUM(i.stock_actual), 0) as total_unidades,
          COALESCE(SUM(i.stock_actual * p.precio_compra), 0) as valor_compra,
          COALESCE(SUM(i.stock_actual * p.precio_venta), 0) as valor_venta
        FROM productos p
        JOIN inventario_sucursales i ON p.id = i.producto_id
        WHERE p.activo = true AND i.sucursal_id = $1
      `;
      params.push(sucursal_id);
    } else {
      query = `
        SELECT 
          COUNT(DISTINCT p.id) as total_productos,
          COALESCE(SUM(i.stock_actual), 0) as total_unidades,
          COALESCE(SUM(i.stock_actual * p.precio_compra), 0) as valor_compra,
          COALESCE(SUM(i.stock_actual * p.precio_venta), 0) as valor_venta
        FROM productos p
        JOIN inventario_sucursales i ON p.id = i.producto_id
        WHERE p.activo = true
      `;
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET top-selling
router.get('/top-selling', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const sucursal_id = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? req.query.sucursal_id : null;
    
    let query = `
      SELECT p.id, p.nombre, p.codigo, 
             COALESCE(SUM(DISTINCT i.stock_actual), 0) as stock_actual, 
             SUM(dv.cantidad) as total_vendido
      FROM productos p
      JOIN detalle_ventas dv ON p.id = dv.producto_id
      JOIN ventas v ON dv.venta_id = v.id
      LEFT JOIN inventario_sucursales i ON p.id = i.producto_id ${sucursal_id ? 'AND i.sucursal_id = $1' : ''}
      WHERE v.estado = 'completada'
    `;
    const params = [];
    let paramIdx = 1;
    
    if (sucursal_id) {
      query += ` AND v.sucursal_id = $${paramIdx++}`;
      params.push(sucursal_id);
    }

    if (req.query.fechaInicio && req.query.fechaFin) {
      query += ` AND v.fecha >= $${paramIdx++} AND v.fecha <= $${paramIdx++}`;
      params.push(req.query.fechaInicio, req.query.fechaFin + ' 23:59:59');
    }
    
    query += ` GROUP BY p.id, p.nombre, p.codigo ORDER BY total_vendido DESC LIMIT $${paramIdx++}`;
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
    const sucursal_id = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? req.query.sucursal_id : null;
    
    let query = `
      SELECT p.id, p.nombre, p.codigo, 
             COALESCE(SUM(DISTINCT i.stock_actual), 0) as stock_actual, 
             COALESCE(SUM(dv.cantidad), 0) as total_vendido
      FROM productos p
      LEFT JOIN detalle_ventas dv ON p.id = dv.producto_id
      LEFT JOIN ventas v ON dv.venta_id = v.id AND v.estado = 'completada' 
        AND v.fecha >= NOW() - INTERVAL '${days} days' ${sucursal_id ? 'AND v.sucursal_id = $1' : ''}
      LEFT JOIN inventario_sucursales i ON p.id = i.producto_id ${sucursal_id ? 'AND i.sucursal_id = $1' : ''}
      WHERE p.activo = true
    `;
    const params = [];
    let paramIdx = 1;

    if (sucursal_id) {
      params.push(sucursal_id);
      paramIdx++;
    }

    query += ` GROUP BY p.id, p.nombre, p.codigo ORDER BY total_vendido ASC LIMIT $${paramIdx++}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
