const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

// Check if any users exist
router.get('/check-users', async (req, res, next) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM usuarios');
    const hasUsers = parseInt(result.rows[0].count, 10) > 0;
    res.json({ success: true, hasUsers });
  } catch (err) {
    next(err);
  }
});

// Setup first admin user
router.post('/setup', async (req, res, next) => {
  try {
    const checkResult = await db.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(checkResult.rows[0].count, 10) > 0) {
      return res.status(400).json({ success: false, message: 'Setup ya fue completado' });
    }

    const { nombre, username, password } = req.body;
    if (!nombre || !username || !password) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      [nombre, username.toLowerCase().trim(), hash, 'admin']
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const result = await db.query('SELECT * FROM usuarios WHERE username = $1 AND activo = true', [username.toLowerCase().trim()]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const payload = {
      id: user.id,
      nombre: user.nombre,
      username: user.username,
      rol: user.rol
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ success: true, token, user: payload });
  } catch (err) {
    next(err);
  }
});

// Get current user (verify token)
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
