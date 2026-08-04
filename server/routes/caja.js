const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

router.use(auth);

// GET all
router.get('/', async (req, res, next) => {
  try {
    let query = `
      SELECT m.*, u.nombre as usuario_nombre
      FROM movimientos_caja m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.fecha_inicio) {
      query += ` AND (m.fecha AT TIME ZONE 'America/Lima')::date >= $${paramIdx++}::date`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND (m.fecha AT TIME ZONE 'America/Lima')::date <= $${paramIdx++}::date`;
      params.push(req.query.fecha_fin);
    }
    if (req.query.tipo) {
      query += ` AND m.tipo = $${paramIdx++}`;
      params.push(req.query.tipo);
    }

    query += ' ORDER BY m.fecha DESC LIMIT 200';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET resumen
router.get('/resumen', async (req, res, next) => {
  try {
    // Resumen general de movimientos de caja
    let query = `
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END), 0) as total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END), 0) as total_egresos
      FROM movimientos_caja WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.fechaInicio) {
      query += ` AND (fecha AT TIME ZONE 'America/Lima')::date >= $${paramIdx++}::date`;
      params.push(req.query.fechaInicio);
    }
    if (req.query.fechaFin) {
      query += ` AND (fecha AT TIME ZONE 'America/Lima')::date <= $${paramIdx++}::date`;
      params.push(req.query.fechaFin);
    }

    const result = await db.query(query, params);
    const data = result.rows[0];
    data.saldo_neto = parseFloat(data.total_ingresos) - parseFloat(data.total_egresos);

    // Desglose de ingresos por método de pago (join con tabla ventas a través del concepto)
    // Los ingresos de venta tienen concepto "Venta BXXX-NNNN" o "Venta FXXX-NNNN"
    let pagoQuery = `
      SELECT
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE 0 END), 0)       as ingresos_efectivo,
        COALESCE(SUM(CASE WHEN v.metodo_pago IN ('transferencia', 'tarjeta') THEN v.total ELSE 0 END), 0) as ingresos_yape,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total ELSE 0 END), 0)        as ingresos_tarjeta,
        COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0)  as ingresos_transferencia
      FROM ventas v
      WHERE v.estado = 'completada'
    `;
    const pagoParams = [];
    let pagoIdx = 1;

    if (req.query.fechaInicio) {
      pagoQuery += ` AND (v.fecha AT TIME ZONE 'America/Lima')::date >= $${pagoIdx++}::date`;
      pagoParams.push(req.query.fechaInicio);
    }
    if (req.query.fechaFin) {
      pagoQuery += ` AND (v.fecha AT TIME ZONE 'America/Lima')::date <= $${pagoIdx++}::date`;
      pagoParams.push(req.query.fechaFin);
    }

    const pagoResult = await db.query(pagoQuery, pagoParams);
    const pagoData = pagoResult.rows[0];

    data.ingresos_efectivo      = parseFloat(pagoData.ingresos_efectivo      || 0);
    data.ingresos_yape          = parseFloat(pagoData.ingresos_yape          || 0);
    data.ingresos_tarjeta       = parseFloat(pagoData.ingresos_tarjeta       || 0);
    data.ingresos_transferencia = parseFloat(pagoData.ingresos_transferencia || 0);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { tipo, concepto, monto, notas } = req.body;
    if (!monto || monto <= 0) {
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });
    }

    const result = await db.query(`
      INSERT INTO movimientos_caja (tipo, concepto, monto, notas, usuario_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [tipo, concepto, monto, notas || '', req.user.id]);

    const io = req.app.get('io');
    if (io) io.emit('caja:updated');

    const tipoLabel = tipo === 'ingreso' ? 'Ingreso' : 'Egreso';
    await logActivity(db, req.user.id, 'MOVIMIENTO_CAJA', `${tipoLabel} manual: S/ ${parseFloat(monto).toFixed(2)} — '${concepto}'`);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
