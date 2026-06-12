const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth);

// GET config
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT update config
router.put('/', adminOnly, async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    let paramIdx = 1;
    const allowed = ['nombre_empresa', 'ruc', 'direccion', 'telefono',
      'logo_path', 'moneda_simbolo', 'serie_boleta', 'serie_factura', 
      'mensaje_ticket', 'printer_ip', 'printer_port'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length > 0) {
      await db.query(`UPDATE config_empresa SET ${fields.join(', ')} WHERE id = 1`, values);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET next comprobante number
router.get('/comprobantes/next/:tipo', async (req, res, next) => {
  try {
    const { tipo } = req.params;
    const configRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const config = configRes.rows[0];
    
    let numero;
    if (tipo === 'factura') {
      const nextNum = parseInt(config.correlativo_factura, 10) + 1;
      numero = `${config.serie_factura}-${String(nextNum).padStart(8, '0')}`;
    } else {
      const nextNum = parseInt(config.correlativo_boleta, 10) + 1;
      numero = `${config.serie_boleta}-${String(nextNum).padStart(8, '0')}`;
    }
    
    res.json({ success: true, data: numero });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
