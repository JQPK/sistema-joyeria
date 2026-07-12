const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

router.use(auth);

// GET all (excluding passwords)
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, nombre, username, rol, activo, created_at 
      FROM usuarios ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST create user
router.post('/', adminOnly, async (req, res, next) => {
  try {
    const { nombre, username, password, rol } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await db.query(`
      INSERT INTO usuarios (nombre, username, password_hash, rol) 
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [nombre, username.toLowerCase().trim(), hash, rol || 'cajero']);

    await logActivity(db, req.user.id, 'USUARIO_CREADO', `Nuevo usuario creado: '${username}' (nombre: ${nombre}, rol: ${rol || 'cajero'})`);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }
    next(err);
  }
});

// PUT update user
router.put('/:id', adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, username, rol, password } = req.body;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      await db.query(`
        UPDATE usuarios SET nombre = $1, username = $2, password_hash = $3, rol = $4 WHERE id = $5
      `, [nombre, username.toLowerCase().trim(), hash, rol, id]);
    } else {
      await db.query(`
        UPDATE usuarios SET nombre = $1, username = $2, rol = $3 WHERE id = $4
      `, [nombre, username.toLowerCase().trim(), rol, id]);
    }

    await logActivity(db, req.user.id, 'USUARIO_MODIFICADO', `Usuario '${username}' (ID: ${id}) modificado por el administrador`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST toggle active status
router.post('/:id/toggle', adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userRes = await db.query('SELECT activo FROM usuarios WHERE id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    
    const newStatus = !userRes.rows[0].activo;
    await db.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [newStatus, id]);
    
    res.json({ success: true, activo: newStatus });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
