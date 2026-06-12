const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');

// POST register device (public - called by app on first run)
router.post('/registrar', async (req, res, next) => {
  try {
    const { deviceId, deviceName, deviceModel, osVersion, appVersion } = req.body;
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });

    // Check if exists
    const existing = await db.query('SELECT * FROM dispositivos WHERE device_id = $1', [deviceId]);
    
    if (existing.rows.length > 0) {
      // Update last access
      await db.query('UPDATE dispositivos SET ultimo_acceso = NOW(), ip_ultimo_acceso = $1 WHERE device_id = $2', 
        [req.ip, deviceId]);
      return res.json({ 
        success: true, 
        status: existing.rows[0].licencia_activa ? 'activa' : 'pendiente',
        message: existing.rows[0].licencia_activa ? 'Licencia activa' : 'Esperando activación del administrador'
      });
    }

    // Create new
    await db.query(`
      INSERT INTO dispositivos (device_id, device_name, device_model, os_version, app_version, ip_ultimo_acceso)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [deviceId, deviceName || '', deviceModel || '', osVersion || '', appVersion || '', req.ip]);

    res.json({ 
      success: true, 
      status: 'pendiente', 
      message: 'Dispositivo registrado. Esperando activación del administrador.' 
    });
  } catch (err) {
    next(err);
  }
});

// GET verify license (public - called by app periodically)
router.get('/verificar/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const result = await db.query('SELECT * FROM dispositivos WHERE device_id = $1 AND activo = true', [deviceId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, activa: false, message: 'Dispositivo no registrado o revocado' });
    }

    const device = result.rows[0];
    
    // Update last access
    await db.query('UPDATE dispositivos SET ultimo_acceso = NOW(), ip_ultimo_acceso = $1 WHERE id = $2', [req.ip, device.id]);

    if (!device.licencia_activa) {
      return res.json({ success: true, activa: false, message: 'Esperando activación' });
    }

    res.json({ success: true, activa: true, clientName: 'Joyería Mariné' });
  } catch (err) {
    next(err);
  }
});

// -- ADMIN ROUTES BELOW --
router.use(auth);
router.use(adminOnly);

// GET all devices
router.get('/dispositivos', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM dispositivos ORDER BY fecha_registro DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST activate license
router.post('/activar/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    await db.query(`
      UPDATE dispositivos 
      SET licencia_activa = true, fecha_activacion = NOW(), activo = true 
      WHERE device_id = $1
    `, [deviceId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST revoke license
router.post('/revocar/:deviceId', async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    await db.query(`
      UPDATE dispositivos 
      SET licencia_activa = false, activo = false 
      WHERE device_id = $1
    `, [deviceId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
