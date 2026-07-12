const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth);

// GET activity log (admin only) — auto-purges records older than 15 days
router.get('/', adminOnly, async (req, res, next) => {
  try {
    // Auto-purge records older than 15 days
    await db.query(`DELETE FROM actividad_usuarios WHERE fecha < NOW() - INTERVAL '15 days'`);

    let query = `
      SELECT a.*, u.nombre as usuario_nombre, u.username, u.rol as usuario_rol
      FROM actividad_usuarios a
      JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.usuario_id) {
      query += ` AND a.usuario_id = $${paramIdx++}`;
      params.push(req.query.usuario_id);
    }
    if (req.query.accion) {
      query += ` AND a.accion = $${paramIdx++}`;
      params.push(req.query.accion);
    }
    if (req.query.fecha_inicio) {
      query += ` AND a.fecha >= $${paramIdx++}`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND a.fecha <= $${paramIdx++}`;
      params.push(req.query.fecha_fin + ' 23:59:59');
    }

    query += ' ORDER BY a.fecha DESC LIMIT 500';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET stats for today (admin only)
router.get('/stats', adminOnly, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_hoy,
        COUNT(CASE WHEN accion = 'LOGIN' THEN 1 END) as logins,
        COUNT(CASE WHEN accion = 'LOGIN_FALLIDO' THEN 1 END) as logins_fallidos,
        COUNT(CASE WHEN accion = 'VENTA_COMPLETADA' THEN 1 END) as ventas,
        COUNT(CASE WHEN accion = 'BOLETA_ANULADA' THEN 1 END) as anulaciones,
        COUNT(CASE WHEN accion IN ('STOCK_ACTUALIZADO', 'VARIANTE_MODIFICADA') THEN 1 END) as cambios_stock,
        COUNT(CASE WHEN accion IN ('PRODUCTO_CREADO', 'PRODUCTO_ELIMINADO', 'IMPORTACION_EXCEL') THEN 1 END) as cambios_inventario
      FROM actividad_usuarios
      WHERE DATE(fecha AT TIME ZONE 'America/Lima') = CURRENT_DATE AT TIME ZONE 'America/Lima'
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST log activity (called from frontend for logout etc.)
router.post('/', async (req, res, next) => {
  try {
    const { accion, detalles } = req.body;
    await db.query(`
      INSERT INTO actividad_usuarios (usuario_id, accion, detalles)
      VALUES ($1, $2, $3)
    `, [req.user.id, accion, detalles || '']);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
