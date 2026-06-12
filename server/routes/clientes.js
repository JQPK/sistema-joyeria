const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET all
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM clientes ORDER BY nombre ASC');
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
      SELECT * FROM clientes
      WHERE nombre ILIKE $1 OR dni_ruc ILIKE $1 OR telefono ILIKE $1
      ORDER BY nombre ASC LIMIT 20
    `, [term]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { nombre, dni_ruc, telefono, email, direccion, notas } = req.body;
    const result = await db.query(`
      INSERT INTO clientes (nombre, dni_ruc, telefono, email, direccion, notas)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [nombre, dni_ruc || '', telefono || '', email || '', direccion || '', notas || '']);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let paramIdx = 1;
    const allowed = ['nombre', 'dni_ruc', 'telefono', 'email', 'direccion', 'notas'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await db.query(`UPDATE clientes SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const countRes = await db.query('SELECT COUNT(*) FROM ventas WHERE cliente_id = $1', [id]);
    if (parseInt(countRes.rows[0].count, 10) > 0) {
      return res.status(400).json({ success: false, message: 'El cliente tiene ventas registradas, no puede eliminarse.' });
    }
    await db.query('DELETE FROM clientes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET history
router.get('/:id/historial', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM ventas WHERE cliente_id = $1 ORDER BY fecha DESC', [req.params.id]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
