const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth);

// GET activity log
router.get('/', adminOnly, async (req, res, next) => {
  try {
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
    if (req.query.fecha_inicio) {
      query += ` AND a.fecha >= $${paramIdx++}`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND a.fecha <= $${paramIdx++}`;
      params.push(req.query.fecha_fin + ' 23:59:59');
    }

    query += ' ORDER BY a.fecha DESC LIMIT 200';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST log activity
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
