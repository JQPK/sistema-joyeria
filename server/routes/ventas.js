const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET all
router.get('/', async (req, res, next) => {
  try {
    let query = `
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc as cliente_dni_ruc,
             u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.fecha_inicio) {
      query += ` AND v.fecha >= $${paramIdx++}`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND v.fecha <= $${paramIdx++}`;
      params.push(req.query.fecha_fin + ' 23:59:59');
    }
    if (req.query.estado) {
      query += ` AND v.estado = $${paramIdx++}`;
      params.push(req.query.estado);
    }
    if (req.query.tipo_comprobante) {
      query += ` AND v.tipo_comprobante = $${paramIdx++}`;
      params.push(req.query.tipo_comprobante);
    }

    if (req.query.limit !== 'false') {
      query += ' ORDER BY v.fecha DESC LIMIT 100';
    } else {
      query += ' ORDER BY v.fecha DESC';
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET stats
router.get('/stats/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    let dateFilter = '';
    
    if (period === 'today') {
      dateFilter = "AND v.fecha::date = NOW()::date";
    } else if (period === 'week') {
      dateFilter = "AND v.fecha >= NOW() - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND v.fecha >= NOW() - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(CASE WHEN estado = 'completada' THEN total ELSE 0 END), 0) as total_monto,
        COALESCE(AVG(CASE WHEN estado = 'completada' THEN total ELSE NULL END), 0) as ticket_promedio
      FROM ventas v
      WHERE estado = 'completada' ${dateFilter}
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET daily-stats
router.get('/daily-stats', async (req, res, next) => {
  try {
    let query = `
      SELECT
        v.fecha::date as dia,
        SUM(CASE WHEN estado = 'completada' THEN total ELSE 0 END) as total,
        COUNT(CASE WHEN estado = 'completada' THEN 1 END) as num_ventas
      FROM ventas v
    `;
    const params = [];
    
    if (req.query.fechaInicio && req.query.fechaFin) {
      query += ` WHERE v.fecha >= $1 AND v.fecha <= $2`;
      params.push(req.query.fechaInicio, req.query.fechaFin + ' 23:59:59');
    } else {
      query += ` WHERE v.fecha >= NOW() - INTERVAL '7 days'`;
    }
    
    query += ` GROUP BY v.fecha::date ORDER BY dia ASC`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET by id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ventaRes = await db.query(`
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc as cliente_dni_ruc,
             c.telefono as cliente_telefono, c.direccion as cliente_direccion,
             u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = $1
    `, [id]);
    
    if (ventaRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    
    const itemsRes = await db.query(`
      SELECT dv.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1
    `, [id]);
    
    const venta = ventaRes.rows[0];
    venta.items = itemsRes.rows;
    res.json({ success: true, data: venta });
  } catch (err) {
    next(err);
  }
});

// POST create sale
router.post('/', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const data = req.body;
    data.usuario_id = req.user.id; // Assign to current user

    // 1. Get next correlative
    const configRes = await client.query('SELECT * FROM config_empresa WHERE id = 1');
    const config = configRes.rows[0];
    let serie, correlativo, campo;
    
    if (data.tipo_comprobante === 'factura') {
      serie = config.serie_factura;
      correlativo = config.correlativo_factura + 1;
      campo = 'correlativo_factura';
    } else {
      serie = config.serie_boleta;
      correlativo = config.correlativo_boleta + 1;
      campo = 'correlativo_boleta';
    }
    const numero = `${serie}-${String(correlativo).padStart(8, '0')}`;

    // 2. Update correlative
    await client.query(`UPDATE config_empresa SET ${campo} = $1 WHERE id = 1`, [correlativo]);

    // 3. Insert sale
    const ventaRes = await client.query(`
      INSERT INTO ventas (numero_comprobante, tipo_comprobante, cliente_id, subtotal, descuento, total,
        metodo_pago, monto_pagado, cambio, notas, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `, [
      numero, data.tipo_comprobante || 'boleta', data.cliente_id || null, data.subtotal, 
      data.descuento || 0, data.total, data.metodo_pago || 'efectivo', 
      data.monto_pagado || data.total, data.cambio || 0, data.notas || '', data.usuario_id
    ]);
    const ventaId = ventaRes.rows[0].id;

    // 4. Insert items and update stock
    for (const item of data.items) {
      await client.query(`
        INSERT INTO detalle_ventas (venta_id, producto_id, variante_id, cantidad, precio_unitario, descuento_item, subtotal_item)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [ventaId, item.producto_id, item.variante_id || null, item.cantidad, item.precio_unitario, item.descuento_item || 0, item.subtotal_item]);
      
      if (item.variante_id) {
        await client.query('UPDATE producto_variantes SET stock_actual = stock_actual - $1 WHERE id = $2', [item.cantidad, item.variante_id]);
        await client.query(`
          UPDATE productos 
          SET stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
          WHERE id = $1
        `, [item.producto_id]);
      } else {
        await client.query('UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
      }
    }

    // 5. Register in caja
    await client.query(`
      INSERT INTO movimientos_caja (tipo, concepto, monto, usuario_id)
      VALUES ('ingreso', $1, $2, $3)
    `, [`Venta ${numero}`, data.total, data.usuario_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('sale:created', { id: ventaId });
      io.emit('stock:changed');
    }

    res.json({ success: true, venta_id: ventaId, numero_comprobante: numero });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST void sale
router.post('/:id/anular', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    
    await client.query('BEGIN');
    
    const saleRes = await client.query('SELECT estado FROM ventas WHERE id = $1 FOR UPDATE', [id]);
    if (saleRes.rows.length === 0) throw new Error('Venta no encontrada');
    if (saleRes.rows[0].estado === 'anulada') throw new Error('La venta ya fue anulada');

    // Restore stock
    const itemsRes = await client.query('SELECT producto_id, variante_id, cantidad FROM detalle_ventas WHERE venta_id = $1', [id]);
    for (const item of itemsRes.rows) {
      if (item.variante_id) {
        await client.query('UPDATE producto_variantes SET stock_actual = stock_actual + $1 WHERE id = $2', [item.cantidad, item.variante_id]);
        await client.query(`
          UPDATE productos 
          SET stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
          WHERE id = $1
        `, [item.producto_id]);
      } else {
        await client.query('UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2', [item.cantidad, item.producto_id]);
      }
    }

    // Mark as voided
    await client.query("UPDATE ventas SET estado = 'anulada', motivo_anulacion = $1 WHERE id = $2", [motivo || '', id]);

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('sale:voided', { id });
      io.emit('stock:changed');
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
