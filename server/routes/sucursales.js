const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');

// Get all sucursales
router.get('/', auth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM sucursales ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// Create sucursal (Admin only)
router.post('/', auth, adminOnly, async (req, res, next) => {
  try {
    const { nombre, direccion, telefono } = req.body;
    const result = await db.query(
      'INSERT INTO sucursales (nombre, direccion, telefono) VALUES ($1, $2, $3) RETURNING *',
      [nombre, direccion, telefono]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Update sucursal (Admin only)
router.put('/:id', auth, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono, activo } = req.body;
    const result = await db.query(
      'UPDATE sucursales SET nombre = $1, direccion = $2, telefono = $3, activo = $4 WHERE id = $5 RETURNING *',
      [nombre, direccion, telefono, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sucursal no encontrada' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
