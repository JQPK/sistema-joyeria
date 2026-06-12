const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET all
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM categorias WHERE activo = true ORDER BY nombre ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST create
router.post('/', async (req, res, next) => {
  try {
    const { nombre } = req.body;
    const result = await db.query(
      'INSERT INTO categorias (nombre) VALUES ($1) RETURNING id',
      [nombre]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// PUT update
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    await db.query('UPDATE categorias SET nombre = $1 WHERE id = $2', [nombre, id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check if used
    const countRes = await db.query('SELECT COUNT(*) FROM productos WHERE categoria_id = $1 AND activo = true', [id]);
    if (parseInt(countRes.rows[0].count, 10) > 0) {
      return res.status(400).json({ success: false, message: 'La categoría está en uso por productos activos' });
    }
    
    await db.query('UPDATE categorias SET activo = false WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
