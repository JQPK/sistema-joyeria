const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');

router.use(auth);

// GET all
router.get('/', async (req, res, next) => {
  try {
    let query = `
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc as cliente_dni_ruc,
             u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (req.query.fecha_inicio) {
      query += ` AND v.fecha >= $${paramIdx++}`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND v.fecha <= $${paramIdx++}`;
      params.push(req.query.fecha_fin + ' 23:59:59');
    }
    if (req.query.estado) {
      query += ` AND v.estado = $${paramIdx++}`;
      params.push(req.query.estado);
    }
    if (req.query.tipo_comprobante) {
      query += ` AND v.tipo_comprobante = $${paramIdx++}`;
      params.push(req.query.tipo_comprobante);
    }

    if (req.query.limit !== 'false') {
      query += ' ORDER BY v.fecha DESC LIMIT 100';
    } else {
      query += ' ORDER BY v.fecha DESC';
    }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET stats
router.get('/stats/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    let dateFilter = '';
    
    if (period === 'today') {
      dateFilter = "AND v.fecha::date = NOW()::date";
    } else if (period === 'week') {
      dateFilter = "AND v.fecha >= NOW() - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND v.fecha >= NOW() - INTERVAL '30 days'";
    }

    const result = await db.query(`
      SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(CASE WHEN estado = 'completada' THEN total ELSE 0 END), 0) as total_monto,
        COALESCE(AVG(CASE WHEN estado = 'completada' THEN total ELSE NULL END), 0) as ticket_promedio
      FROM ventas v
      WHERE estado = 'completada' ${dateFilter}
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET daily-stats
router.get('/daily-stats', async (req, res, next) => {
  try {
    let query = `
      SELECT
        v.fecha::date as dia,
        SUM(CASE WHEN estado = 'completada' THEN total ELSE 0 END) as total,
        COUNT(CASE WHEN estado = 'completada' THEN 1 END) as num_ventas
      FROM ventas v
    `;
    const params = [];
    
    if (req.query.fechaInicio && req.query.fechaFin) {
      query += ` WHERE v.fecha >= $1 AND v.fecha <= $2`;
      params.push(req.query.fechaInicio, req.query.fechaFin + ' 23:59:59');
    } else {
      query += ` WHERE v.fecha >= NOW() - INTERVAL '7 days'`;
    }
    
    query += ` GROUP BY v.fecha::date ORDER BY dia ASC`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET by id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const ventaRes = await db.query(`
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc as cliente_dni_ruc,
             c.telefono as cliente_telefono, c.direccion as cliente_direccion,
             u.nombre as vendedor_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = $1
    `, [id]);
    
    if (ventaRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    
    const itemsRes = await db.query(`
      SELECT dv.*, p.nombre as producto_nombre, p.codigo as producto_codigo
      FROM detalle_ventas dv
      JOIN productos p ON dv.producto_id = p.id
      WHERE dv.venta_id = $1
    `, [id]);
    
    const venta = ventaRes.rows[0];
    venta.items = itemsRes.rows;
    res.json({ success: true, data: venta });
  } catch (err) {
    next(err);
  }
});

// POST create sale
router.post('/', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    
    const data = req.body;
    data.usuario_id = req.user.id; // Assign to current user

    // 1. Get next correlative
    const configRes = await client.query('SELECT * FROM config_empresa WHERE id = 1');
    const config = configRes.rows[0];
    let serie, correlativo, campo;
    
    if (data.tipo_comprobante === 'factura') {
      serie = config.serie_factura;
      correlativo = config.correlativo_factura + 1;
      campo = 'correlativo_factura';
    } else {
      serie = config.serie_boleta;
      correlativo = config.correlativo_boleta + 1;
      campo = 'correlativo_boleta';
    }
    const numero = `${serie}-${String(correlativo).padStart(8, '0')}`;

    // 2. Update correlative
    await client.query(`UPDATE config_empresa SET ${campo} = $1 WHERE id = 1`, [correlativo]);

    // 3. Insert sale
    const ventaRes = await client.query(`
      INSERT INTO ventas (numero_comprobante, tipo_comprobante, cliente_id, subtotal, descuento, total,
        metodo_pago, monto_pagado, cambio, notas, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `, [
      numero, data.tipo_comprobante || 'boleta', data.cliente_id || null, data.subtotal, 
      data.descuento || 0, data.total, data.metodo_pago || 'efectivo', 
      data.monto_pagado || data.total, data.cambio || 0, data.notas || '', data.usuario_id
    ]);
    const ventaId = ventaRes.rows[0].id;

    // 4. Validate stock BEFORE inserting items (prevents negative stock)
    for (const item of data.items) {
      if (item.variante_id) {
        const stockRes = await client.query(
          'SELECT stock_actual, nombre_variante FROM producto_variantes WHERE id = $1',
          [item.variante_id]
        );
        if (stockRes.rows.length === 0) throw new Error(`Variante no encontrada (id: ${item.variante_id})`);
        const stockDisponible = stockRes.rows[0].stock_actual;
        if (stockDisponible < item.cantidad) {
          const nombre = stockRes.rows[0].nombre_variante;
          throw new Error(`Stock insuficiente para "${nombre}": disponible ${stockDisponible}, solicitado ${item.cantidad}`);
        }
      } else {
        const stockRes = await client.query(
          'SELECT stock_actual, nombre FROM productos WHERE id = $1',
          [item.producto_id]
        );
        if (stockRes.rows.length === 0) throw new Error(`Producto no encontrado (id: ${item.producto_id})`);
        const stockDisponible = stockRes.rows[0].stock_actual;
        if (stockDisponible < item.cantidad) {
          const nombre = stockRes.rows[0].nombre;
          throw new Error(`Stock insuficiente para "${nombre}": disponible ${stockDisponible}, solicitado ${item.cantidad}`);
        }
      }
    }

    // 5. Insert items and update stock
    for (const item of data.items) {
      await client.query(`
        INSERT INTO detalle_ventas (venta_id, producto_id, variante_id, cantidad, precio_unitario, descuento_item, subtotal_item)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [ventaId, item.producto_id, item.variante_id || null, item.cantidad, item.precio_unitario, item.descuento_item || 0, item.subtotal_item]);
      
      if (item.variante_id) {
        await client.query('UPDATE producto_variantes SET stock_actual = stock_actual - $1 WHERE id = $2', [item.cantidad, item.variante_id]);
        await client.query(`
          UPDATE productos 
          SET stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
          WHERE id = $1
        `, [item.producto_id]);
      } else {
        await client.query('UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
      }
    }

    // 5. Register in caja
    await client.query(`
      INSERT INTO movimientos_caja (tipo, concepto, monto, usuario_id)
      VALUES ('ingreso', $1, $2, $3)
    `, [`Venta ${numero}`, data.total, data.usuario_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('sale:created', { id: ventaId });
      io.emit('stock:changed');
    }

    res.json({ success: true, venta_id: ventaId, numero_comprobante: numero });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST void sale
router.post('/:id/anular', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    
    await client.query('BEGIN');
    
    const saleRes = await client.query('SELECT numero_comprobante, total, estado FROM ventas WHERE id = $1 FOR UPDATE', [id]);
    if (saleRes.rows.length === 0) throw new Error('Venta no encontrada');
    if (saleRes.rows[0].estado === 'anulada') throw new Error('La venta ya fue anulada');
    
    const venta = saleRes.rows[0];

    // Restore stock
    const itemsRes = await client.query('SELECT producto_id, variante_id, cantidad FROM detalle_ventas WHERE venta_id = $1', [id]);
    for (const item of itemsRes.rows) {
      if (item.variante_id) {
        await client.query('UPDATE producto_variantes SET stock_actual = stock_actual + $1 WHERE id = $2', [item.cantidad, item.variante_id]);
        await client.query(`
          UPDATE productos 
          SET stock_actual = (SELECT COALESCE(SUM(stock_actual), 0) FROM producto_variantes WHERE producto_id = $1 AND activo = true)
          WHERE id = $1
        `, [item.producto_id]);
      } else {
        await client.query('UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2', [item.cantidad, item.producto_id]);
      }
    }

    // Mark as voided
    await client.query("UPDATE ventas SET estado = 'anulada', motivo_anulacion = $1 WHERE id = $2", [motivo || '', id]);

    // Register cash refund (egreso)
    await client.query(`
      INSERT INTO movimientos_caja (tipo, concepto, monto, usuario_id)
      VALUES ('egreso', $1, $2, $3)
    `, [`Boleta ${venta.numero_comprobante} anulada`, venta.total, req.user.id]);

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    if (io) {
      io.emit('sale:voided', { id });
      io.emit('stock:changed');
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// GET ticket HTML
router.get('/:id/ticket', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Fetch sale
    const ventaRes = await db.query(`
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc, u.nombre as cajero
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = $1
    `, [id]);
    
    if (ventaRes.rows.length === 0) {
      return res.status(404).send('Venta no encontrada');
    }
    const venta = ventaRes.rows[0];

    // Fetch items
    const itemsRes = await db.query(`
      SELECT d.*, p.nombre as producto_nombre, pv.nombre_variante 
      FROM detalle_ventas d
      JOIN productos p ON d.producto_id = p.id
      LEFT JOIN producto_variantes pv ON d.variante_id = pv.id
      WHERE d.venta_id = $1
    `, [id]);
    const items = itemsRes.rows;

    // Fetch config
    const confRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const config = confRes.rows[0] || {};

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ccc;">${item.cantidad}x ${item.producto_nombre} ${item.nombre_variante ? `(${item.nombre_variante})` : ''}</td>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ccc; text-align: right;">S/ ${parseFloat(item.subtotal_item).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket ${venta.numero_comprobante}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0; padding: 10px; color: #000; background: #fff; }
          .ticket { width: 100%; max-width: 300px; margin: 0 auto; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .mb { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          @media print {
            @page { margin: 0; }
            body { padding: 0; margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="text-center mb">
            <h2 style="margin:0">${config.nombre_empresa || 'Joyería Mariné'}</h2>
            <div>${config.ruc ? `RUC: ${config.ruc}` : ''}</div>
            <div>${config.direccion || ''}</div>
            <div>${config.telefono || ''}</div>
          </div>
          <div class="text-center mb" style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0;">
            <div class="bold">COMPROBANTE DE PAGO</div>
            <div>${venta.numero_comprobante}</div>
          </div>
          <div class="mb">
            <div>Fecha: ${new Date(venta.fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</div>
            <div>Cajero: ${venta.cajero || 'Admin'}</div>
            ${venta.cliente_nombre ? `<div>Cliente: ${venta.cliente_nombre}</div>` : ''}
          </div>
          <table class="mb">
            <thead>
              <tr>
                <th style="text-align: left; border-bottom: 1px solid #000;">Cant/Prod</th>
                <th style="text-align: right; border-bottom: 1px solid #000;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <table class="mb" style="margin-left: auto; width: 60%;">
            <tr><td>Subtotal:</td><td class="text-right">S/ ${parseFloat(venta.subtotal).toFixed(2)}</td></tr>
            ${venta.descuento > 0 ? `<tr><td>Desc:</td><td class="text-right">- S/ ${parseFloat(venta.descuento).toFixed(2)}</td></tr>` : ''}
            <tr class="bold"><td>Total:</td><td class="text-right">S/ ${parseFloat(venta.total).toFixed(2)}</td></tr>
          </table>
          <div class="text-center mb" style="font-size: 0.9em;">
            ${config.mensaje_ticket || '¡Gracias por su compra!'}
          </div>
          <div class="no-print text-center" style="margin-top: 30px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Imprimir Ticket</button>
          </div>
        </div>
        <script>
          if (new URLSearchParams(window.location.search).get('print') === 'true') {
            window.onload = () => window.print();
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET ticket PDF
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Fetch sale
    const ventaRes = await db.query(`
      SELECT v.*, c.nombre as cliente_nombre, c.dni_ruc, u.nombre as cajero
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = $1
    `, [id]);
    
    if (ventaRes.rows.length === 0) {
      return res.status(404).send('Venta no encontrada');
    }
    const venta = ventaRes.rows[0];

    // Fetch items
    const itemsRes = await db.query(`
      SELECT d.*, p.nombre as producto_nombre, pv.nombre_variante 
      FROM detalle_ventas d
      JOIN productos p ON d.producto_id = p.id
      LEFT JOIN producto_variantes pv ON d.variante_id = pv.id
      WHERE d.venta_id = $1
    `, [id]);
    const items = itemsRes.rows;

    // Fetch config
    const confRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const config = confRes.rows[0] || {};

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 30, size: [250, 600] });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Boleta_${venta.numero_comprobante}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text(config.nombre_empresa || 'Joyería Mariné', { align: 'center' });
    doc.fontSize(10).font('Helvetica');
    if (config.ruc) doc.text(`RUC: ${config.ruc}`, { align: 'center' });
    if (config.direccion) doc.text(config.direccion, { align: 'center' });
    if (config.telefono) doc.text(config.telefono, { align: 'center' });
    
    doc.moveDown();
    doc.font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.text(venta.numero_comprobante, { align: 'center' });
    doc.font('Helvetica').moveDown();

    doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
    doc.text(`Cajero: ${venta.cajero || 'Admin'}`);
    if (venta.cliente_nombre) doc.text(`Cliente: ${venta.cliente_nombre}`);
    
    doc.moveDown();
    
    // Items table header
    doc.font('Helvetica-Bold');
    doc.text('Cant/Prod', 30, doc.y, { continued: true });
    doc.text('Importe', { align: 'right' });
    doc.moveTo(30, doc.y).lineTo(220, doc.y).stroke();
    doc.moveDown(0.5);

    // Items
    doc.font('Helvetica');
    items.forEach(item => {
      const name = `${item.cantidad}x ${item.producto_nombre} ${item.nombre_variante ? `(${item.nombre_variante})` : ''}`;
      const amount = `S/ ${parseFloat(item.subtotal_item).toFixed(2)}`;
      
      const currentY = doc.y;
      doc.text(name, 30, currentY, { width: 130 });
      doc.text(amount, 160, currentY, { width: 60, align: 'right' });
      doc.moveDown(0.5);
    });

    doc.moveTo(30, doc.y).lineTo(220, doc.y).stroke();
    doc.moveDown();

    // Totals
    const subtotal = `S/ ${parseFloat(venta.subtotal).toFixed(2)}`;
    doc.text('Subtotal:', 100, doc.y, { continued: true });
    doc.text(subtotal, { align: 'right' });
    
    if (venta.descuento > 0) {
      const desc = `- S/ ${parseFloat(venta.descuento).toFixed(2)}`;
      doc.text('Desc:', 100, doc.y, { continued: true });
      doc.text(desc, { align: 'right' });
    }

    const total = `S/ ${parseFloat(venta.total).toFixed(2)}`;
    doc.font('Helvetica-Bold');
    doc.text('Total:', 100, doc.y, { continued: true });
    doc.text(total, { align: 'right' });
    
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).text(config.mensaje_ticket || '¡Gracias por su compra!', { align: 'center' });

    doc.end();

  } catch (err) {
    next(err);
  }
});

module.exports = router;
