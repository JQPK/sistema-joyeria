const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { registrarMovimiento } = require('../services/kardexService');
const PDFDocument = require('pdfkit');

router.use(auth);

// ============================================================================
// HELPER: Cálculo algebraico de esfera de cerca (Esfera Lejos + Adición)
// ============================================================================
function calcEsferaCercaServer(esf, add) {
  if (esf === null || add === null || esf === undefined || add === undefined || esf === '' || add === '') return null;
  const e = parseFloat(String(esf).replace(',', '.'));
  const a = parseFloat(String(add).replace(',', '.'));
  if (isNaN(e) || isNaN(a)) return null;
  const res = e + a;
  return (res > 0 ? '+' : '') + res.toFixed(2);
}

// ============================================================================
// HELPER: Generar Comprobante Oficial de Venta al concretar contrato
// ============================================================================
async function concretarVentaContrato(client, contratoId, reqUser) {
  // 1. Obtener datos del contrato
  const cRes = await client.query(`
    SELECT c.*, cl.nombre as cliente_nombre, cl.dni_ruc as cliente_dni_ruc
    FROM optica_contratos c
    JOIN clientes cl ON c.cliente_id = cl.id
    WHERE c.id = $1
  `, [contratoId]);

  if (cRes.rows.length === 0) return null;
  const contrato = cRes.rows[0];

  // Si ya tiene venta_id, no duplicar
  if (contrato.venta_id) return contrato.venta_id;

  // 2. Determinar tipo de comprobante según documento
  const esFactura = contrato.cliente_dni_ruc && contrato.cliente_dni_ruc.length === 11;
  const tipoComprobante = esFactura ? 'factura' : 'boleta';

  // 3. Obtener correlativo
  const confRes = await client.query('SELECT * FROM config_empresa WHERE id = 1 FOR UPDATE');
  const conf = confRes.rows[0] || {};
  let serie, correlativo, campo;

  if (tipoComprobante === 'factura') {
    serie = conf.serie_factura || 'F001';
    correlativo = (conf.correlativo_factura || 0) + 1;
    campo = 'correlativo_factura';
  } else {
    serie = conf.serie_boleta || 'B001';
    correlativo = (conf.correlativo_boleta || 0) + 1;
    campo = 'correlativo_boleta';
  }
  const numero = `${serie}-${String(correlativo).padStart(8, '0')}`;
  await client.query(`UPDATE config_empresa SET ${campo} = $1 WHERE id = 1`, [correlativo]);

  // 4. Calcular desglose de pagos acumulados (Efectivo vs Yape)
  const pagosRes = await client.query(
    'SELECT metodo_pago, monto, monto_efectivo, monto_yape FROM optica_pagos WHERE contrato_id = $1',
    [contratoId]
  );

  let totalEfctv = 0;
  let totalYape = 0;
  pagosRes.rows.forEach(p => {
    if (p.metodo_pago === 'efectivo') totalEfctv += parseFloat(p.monto || 0);
    else if (p.metodo_pago === 'yape' || p.metodo_pago === 'transferencia') totalYape += parseFloat(p.monto || 0);
    else if (p.metodo_pago === 'mixto') {
      totalEfctv += parseFloat(p.monto_efectivo || 0);
      totalYape += parseFloat(p.monto_yape || 0);
    } else {
      totalEfctv += parseFloat(p.monto || 0);
    }
  });

  const metodoPagoVenta = (totalEfctv > 0 && totalYape > 0) ? 'mixto' : (totalYape > 0 ? 'transferencia' : 'efectivo');

  // 5. Insertar venta
  const vRes = await client.query(`
    INSERT INTO ventas (
      numero_comprobante, tipo_comprobante, cliente_id, subtotal, descuento, total,
      metodo_pago, monto_pagado, cambio, notas, usuario_id, sucursal_id, monto_efectivo, monto_yape, estado
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, 'completada')
    RETURNING id
  `, [
    numero, tipoComprobante, contrato.cliente_id, contrato.subtotal,
    contrato.descuento, contrato.total, metodoPagoVenta, contrato.total,
    `Orden Óptica ${contrato.codigo_contrato}`, contrato.usuario_id, contrato.sucursal_id,
    totalEfctv, totalYape
  ]);
  const ventaId = vRes.rows[0].id;

  // 6. Insertar detalle de venta (sin descontar stock de nuevo pues ya se reservó en el contrato)
  const itemsRes = await client.query(
    'SELECT * FROM optica_contrato_detalles WHERE contrato_id = $1',
    [contratoId]
  );

  for (const item of itemsRes.rows) {
    // Si no tiene producto_id (ej. es un servicio o luna hecha a medida), vinculamos al primer producto genérico o dejamos producto_id válido
    let prodId = item.producto_id;
    if (!prodId) {
      // Buscar producto de servicio óptico o vitrina
      const pGen = await client.query("SELECT id FROM productos WHERE nombre ILIKE '%Lente%' OR nombre ILIKE '%Servicio%' LIMIT 1");
      prodId = pGen.rows.length > 0 ? pGen.rows[0].id : 1;
    }

    await client.query(`
      INSERT INTO detalle_ventas (
        venta_id, producto_id, variante_id, cantidad, precio_unitario, descuento_item, subtotal_item
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      ventaId, prodId, item.variante_id || null, item.cantidad,
      item.precio_unitario, item.descuento_item || 0, item.subtotal_item
    ]);
  }

  // 7. Enlazar venta al contrato
  await client.query('UPDATE optica_contratos SET venta_id = $1 WHERE id = $2', [ventaId, contratoId]);

  return ventaId;
}

// ============================================================================
// CONTRATOS & ÓRDENES DE TRABAJO
// ============================================================================

// GET /api/optica/contratos - Listado con filtros
router.get('/contratos', async (req, res, next) => {
  try {
    let query = `
      SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        cl.dni_ruc as cliente_dni_ruc,
        cl.telefono as cliente_telefono,
        u.nombre as usuario_nombre,
        s.nombre as sucursal_nombre,
        v.numero_comprobante as venta_numero_comprobante
      FROM optica_contratos c
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN sucursales s ON c.sucursal_id = s.id
      LEFT JOIN ventas v ON c.venta_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let pIdx = 1;

    if (req.query.sucursal_id && req.query.sucursal_id !== 'todas') {
      query += ` AND c.sucursal_id = $${pIdx++}`;
      params.push(req.query.sucursal_id);
    }
    if (req.query.estado) {
      query += ` AND c.estado = $${pIdx++}`;
      params.push(req.query.estado);
    }
    if (req.query.estado_pago) {
      query += ` AND c.estado_pago = $${pIdx++}`;
      params.push(req.query.estado_pago);
    }
    if (req.query.tipo_servicio) {
      query += ` AND c.tipo_servicio = $${pIdx++}`;
      params.push(req.query.tipo_servicio);
    }
    if (req.query.pendientes_entrega === 'true') {
      query += ` AND c.estado NOT IN ('entregado', 'cancelado')`;
    }
    if (req.query.search) {
      query += ` AND (c.codigo_contrato ILIKE $${pIdx} OR cl.nombre ILIKE $${pIdx} OR cl.dni_ruc ILIKE $${pIdx} OR cl.telefono ILIKE $${pIdx})`;
      params.push(`%${req.query.search}%`);
      pIdx++;
    }
    if (req.query.fecha_inicio) {
      query += ` AND c.fecha_contrato >= $${pIdx++}`;
      params.push(req.query.fecha_inicio);
    }
    if (req.query.fecha_fin) {
      query += ` AND c.fecha_contrato <= $${pIdx++}`;
      params.push(req.query.fecha_fin + ' 23:59:59');
    }

    query += ' ORDER BY c.fecha_contrato DESC LIMIT 200';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/optica/contratos/:id - Detalle completo
router.get('/contratos/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cRes = await db.query(`
      SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        cl.dni_ruc as cliente_dni_ruc,
        cl.telefono as cliente_telefono,
        cl.direccion as cliente_direccion,
        cl.email as cliente_email,
        u.nombre as usuario_nombre,
        s.nombre as sucursal_nombre,
        v.numero_comprobante as venta_numero_comprobante,
        v.tipo_comprobante as venta_tipo_comprobante
      FROM optica_contratos c
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN sucursales s ON c.sucursal_id = s.id
      LEFT JOIN ventas v ON c.venta_id = v.id
      WHERE c.id = $1
    `, [id]);

    if (cRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
    }
    const contrato = cRes.rows[0];

    // Detalle de ítems
    const itemsRes = await db.query(
      'SELECT * FROM optica_contrato_detalles WHERE contrato_id = $1 ORDER BY id ASC',
      [id]
    );
    contrato.items = itemsRes.rows;

    // Receta vinculada
    if (contrato.receta_id) {
      const recRes = await db.query('SELECT * FROM optica_recetas WHERE id = $1', [contrato.receta_id]);
      contrato.receta = recRes.rows[0] || null;
    } else {
      contrato.receta = null;
    }

    // Historial de pagos
    const pagosRes = await db.query(`
      SELECT p.*, u.nombre as usuario_nombre
      FROM optica_pagos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.contrato_id = $1
      ORDER BY p.fecha ASC
    `, [id]);
    contrato.pagos = pagosRes.rows;

    // Historial de estados
    const estadosRes = await db.query(`
      SELECT h.*, u.nombre as usuario_nombre
      FROM optica_historial_estados h
      JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.contrato_id = $1
      ORDER BY h.fecha ASC
    `, [id]);
    contrato.historial_estados = estadosRes.rows;

    res.json({ success: true, data: contrato });
  } catch (err) {
    next(err);
  }
});

// POST /api/optica/contratos - Crear Contrato
router.post('/contratos', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;
    const sucursalId = b.sucursal_id || req.user.sucursal_id || 1;
    const usuarioId = req.user.id;

    // 1. Generar código único de contrato (OPT-YY-NNNN)
    const seqRes = await client.query("SELECT nextval('seq_optica_contrato') as val");
    const seqNum = seqRes.rows[0].val;
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    const codigoContrato = `OPT-${yearSuffix}${String(seqNum).padStart(4, '0')}`;

    // 2. Si se adjunta una receta nueva en el payload, guardarla
    let recetaId = b.receta_id || null;
    if (b.receta && !recetaId) {
      const r = b.receta;
      const recInsert = await client.query(`
        INSERT INTO optica_recetas (
          cliente_id, sucursal_id, optometrista_id, edad_atencion,
          od_esfera, od_cilindro, od_eje, od_dp,
          oi_esfera, oi_cilindro, oi_eje, oi_dp,
          od_adicion, oi_adicion, od_esfera_cerca, oi_esfera_cerca, od_dp_cerca, oi_dp_cerca,
          tipo_luna, material_luna, tratamientos, color_tinte, indicaciones, observaciones
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24
        ) RETURNING id
      `, [
        b.cliente_id, sucursalId, usuarioId, b.edad_atencion || null,
        r.od_esfera || null, r.od_cilindro || null, r.od_eje || null, r.od_dp || null,
        r.oi_esfera || null, r.oi_cilindro || null, r.oi_eje || null, r.oi_dp || null,
        r.od_adicion || null, r.oi_adicion || null, r.od_esfera_cerca || calcEsferaCercaServer(r.od_esfera, r.od_adicion), r.oi_esfera_cerca || calcEsferaCercaServer(r.oi_esfera, r.oi_adicion),
        r.od_dp_cerca || null, r.oi_dp_cerca || null,
        r.tipo_luna || '', r.material_luna || '', r.tratamientos || '', r.color_tinte || '',
        r.indicaciones || '', r.observaciones || ''
      ]);
      recetaId = recInsert.rows[0].id;
    }

    // 3. Validar y descontar stock preventivamente (Reserva)
    // Montura
    if (b.montura_tipo === 'inventario_local') {
      if (b.montura_variante_id) {
        const stkVar = await client.query(`
          SELECT ivs.stock_actual, pv.nombre_variante 
          FROM inventario_variantes_sucursales ivs
          JOIN producto_variantes pv ON ivs.variante_id = pv.id
          WHERE ivs.variante_id = $1 AND ivs.sucursal_id = $2
        `, [b.montura_variante_id, sucursalId]);

        if (stkVar.rows.length === 0 || stkVar.rows[0].stock_actual < 1) {
          throw new Error(`No hay stock suficiente de la montura '${stkVar.rows[0]?.nombre_variante || 'seleccionada'}' en esta sucursal.`);
        }
        // Descontar preventivamente de la variante y producto padre
        const curStk = parseInt(stkVar.rows[0].stock_actual, 10);
        await client.query(
          'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual - 1 WHERE variante_id = $1 AND sucursal_id = $2',
          [b.montura_variante_id, sucursalId]
        );
        if (b.montura_producto_id) {
          await client.query(
            'UPDATE inventario_sucursales SET stock_actual = stock_actual - 1 WHERE producto_id = $1 AND sucursal_id = $2',
            [b.montura_producto_id, sucursalId]
          );
        }

        await registrarMovimiento({
          client,
          producto_id: b.montura_producto_id,
          variante_id: b.montura_variante_id,
          sucursal_id: sucursalId,
          usuario_id: usuarioId,
          tipo_movimiento: 'OPTICA_RESERVA',
          tipo_documento: 'CONTRATO_OPTICA',
          documento_referencia: codigoContrato,
          cantidad_salida: 1,
          stock_anterior: curStk,
          stock_saldo: curStk - 1,
          motivo: `Reserva de montura para Orden ${codigoContrato}`
        });
      } else if (b.montura_producto_id) {
        const stkProd = await client.query(`
          SELECT isuc.stock_actual, p.nombre 
          FROM inventario_sucursales isuc
          JOIN productos p ON isuc.producto_id = p.id
          WHERE isuc.producto_id = $1 AND isuc.sucursal_id = $2
        `, [b.montura_producto_id, sucursalId]);

        if (stkProd.rows.length === 0 || stkProd.rows[0].stock_actual < 1) {
          throw new Error(`No hay stock suficiente de la montura '${stkProd.rows[0]?.nombre || 'seleccionada'}' en esta sucursal.`);
        }
        const curStk = parseInt(stkProd.rows[0].stock_actual, 10);
        await client.query(
          'UPDATE inventario_sucursales SET stock_actual = stock_actual - 1 WHERE producto_id = $1 AND sucursal_id = $2',
          [b.montura_producto_id, sucursalId]
        );

        await registrarMovimiento({
          client,
          producto_id: b.montura_producto_id,
          variante_id: null,
          sucursal_id: sucursalId,
          usuario_id: usuarioId,
          tipo_movimiento: 'OPTICA_RESERVA',
          tipo_documento: 'CONTRATO_OPTICA',
          documento_referencia: codigoContrato,
          cantidad_salida: 1,
          stock_anterior: curStk,
          stock_saldo: curStk - 1,
          motivo: `Reserva de montura para Orden ${codigoContrato}`
        });
      }
    }

    // Accesorios y productos adicionales del carrito
    const items = b.items || [];
    for (const it of items) {
      if (it.tipo_item === 'accesorio' || it.tipo_item === 'repuesto') {
        if (it.variante_id) {
          const stk = await client.query(
            'SELECT stock_actual FROM inventario_variantes_sucursales WHERE variante_id = $1 AND sucursal_id = $2',
            [it.variante_id, sucursalId]
          );
          if (stk.rows.length === 0 || stk.rows[0].stock_actual < it.cantidad) {
            throw new Error(`Stock insuficiente para el accesorio '${it.descripcion}' en esta sucursal.`);
          }
          await client.query(
            'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual - $1 WHERE variante_id = $2 AND sucursal_id = $3',
            [it.cantidad, it.variante_id, sucursalId]
          );
          if (it.producto_id) {
            await client.query(
              'UPDATE inventario_sucursales SET stock_actual = stock_actual - $1 WHERE producto_id = $2 AND sucursal_id = $3',
              [it.cantidad, it.producto_id, sucursalId]
            );
          }
        } else if (it.producto_id) {
          const stk = await client.query(
            'SELECT stock_actual FROM inventario_sucursales WHERE producto_id = $1 AND sucursal_id = $2',
            [it.producto_id, sucursalId]
          );
          if (stk.rows.length === 0 || stk.rows[0].stock_actual < it.cantidad) {
            throw new Error(`Stock insuficiente para el producto '${it.descripcion}' en esta sucursal.`);
          }
          await client.query(
            'UPDATE inventario_sucursales SET stock_actual = stock_actual - $1 WHERE producto_id = $2 AND sucursal_id = $3',
            [it.cantidad, it.producto_id, sucursalId]
          );
        }
      }
    }

    // 4. Cálculos económicos
    const subtotal = parseFloat(b.subtotal || 0);
    const descuento = parseFloat(b.descuento || 0);
    const total = parseFloat(b.total || (subtotal - descuento));
    const adelanto = parseFloat(b.monto_adelanto || 0);
    const totalPagado = Math.min(adelanto, total);
    const saldoPendiente = Math.max(0, total - totalPagado);
    const estadoPago = totalPagado >= total ? 'cancelado' : (totalPagado > 0 ? 'parcial' : 'pendiente');

    // 5. Insertar contrato
    const cInsert = await client.query(`
      INSERT INTO optica_contratos (
        codigo_contrato, cliente_id, receta_id, sucursal_id, usuario_id,
        tipo_servicio, montura_tipo, montura_producto_id, montura_variante_id,
        montura_sucursal_origen_id, montura_descripcion, montura_observaciones_lunas_cliente,
        fecha_contrato, fecha_estimada_entrega, responsable_taller, estado,
        subtotal, descuento, total, total_pagado, saldo_pendiente, estado_pago,
        observaciones
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        NOW(), $13, $14, 'registrado',
        $15, $16, $17, $18, $19, $20,
        $21
      ) RETURNING id
    `, [
      codigoContrato, b.cliente_id, recetaId, sucursalId, usuarioId,
      b.tipo_servicio, b.montura_tipo || 'inventario_local', b.montura_producto_id || null, b.montura_variante_id || null,
      b.montura_sucursal_origen_id || sucursalId, b.montura_descripcion || '', b.montura_observaciones_lunas_cliente || '',
      b.fecha_estimada_entrega || null, b.responsable_taller || '',
      subtotal, descuento, total, totalPagado, saldoPendiente, estadoPago,
      b.observaciones || ''
    ]);
    const contratoId = cInsert.rows[0].id;

    // 6. Insertar ítems del contrato
    for (const it of items) {
      await client.query(`
        INSERT INTO optica_contrato_detalles (
          contrato_id, tipo_item, producto_id, variante_id,
          descripcion, cantidad, precio_unitario, descuento_item, subtotal_item
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        contratoId, it.tipo_item, it.producto_id || null, it.variante_id || null,
        it.descripcion, it.cantidad || 1, it.precio_unitario || 0, it.descuento_item || 0, it.subtotal_item || 0
      ]);
    }

    // 7. Registrar abono inicial si existe
    if (adelanto > 0) {
      const metodoPago = b.metodo_pago || 'efectivo';
      const mEfctv = b.monto_efectivo || (metodoPago === 'efectivo' ? adelanto : 0);
      const mYape = b.monto_yape || (metodoPago === 'yape' || metodoPago === 'transferencia' ? adelanto : 0);

      // Asiento en Caja Chica
      const clInfo = await client.query('SELECT nombre FROM clientes WHERE id = $1', [b.cliente_id]);
      const clNombre = clInfo.rows[0]?.nombre || 'Cliente';
      const cajaRes = await client.query(`
        INSERT INTO movimientos_caja (tipo, concepto, monto, usuario_id, sucursal_id)
        VALUES ('ingreso', $1, $2, $3, $4)
        RETURNING id
      `, [`Abono Óptica ${codigoContrato} (${clNombre})`, adelanto, usuarioId, sucursalId]);
      const cajaMovId = cajaRes.rows[0].id;

      // Registro en optica_pagos
      await client.query(`
        INSERT INTO optica_pagos (
          contrato_id, monto, metodo_pago, monto_efectivo, monto_yape,
          usuario_id, sucursal_id, caja_movimiento_id, notas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        contratoId, adelanto, metodoPago, mEfctv, mYape,
        usuarioId, sucursalId, cajaMovId, 'Adelanto inicial de contrato'
      ]);
    }

    // 8. Historial de estados
    await client.query(`
      INSERT INTO optica_historial_estados (contrato_id, estado_anterior, estado_nuevo, usuario_id, observaciones)
      VALUES ($1, 'borrador', 'registrado', $2, 'Creación de contrato')
    `, [contratoId, usuarioId]);

    await client.query('COMMIT');

    // Notificaciones en tiempo real
    const io = req.app.get('io');
    if (io) {
      io.emit('stock:changed');
      io.emit('optica:contract_created', { id: contratoId, codigo: codigoContrato });
    }

    await logActivity(db, usuarioId, 'CONTRATO_OPTICA_CREADO', `Contrato ${codigoContrato} por S/ ${total.toFixed(2)} (Adelanto: S/ ${adelanto.toFixed(2)})`);

    res.json({
      success: true,
      id: contratoId,
      codigo_contrato: codigoContrato,
      data: {
        id: contratoId,
        codigo_contrato: codigoContrato,
        total,
        total_pagado: totalPagado,
        saldo_pendiente: saldoPendiente,
        estado: 'registrado',
        cliente_id: b.cliente_id
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/optica/contratos/:id/pagos - Registrar nuevo abono
router.post('/contratos/:id/pagos', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { monto, metodo_pago, monto_efectivo, monto_yape, notas } = req.body;
    const usuarioId = req.user.id;

    const abonar = parseFloat(monto || 0);
    if (abonar <= 0) throw new Error('El monto del abono debe ser mayor a 0');

    // Obtener contrato
    const cRes = await client.query(
      'SELECT c.*, cl.nombre as cliente_nombre FROM optica_contratos c JOIN clientes cl ON c.cliente_id = cl.id WHERE c.id = $1 FOR UPDATE',
      [id]
    );
    if (cRes.rows.length === 0) throw new Error('Contrato no encontrado');
    const contrato = cRes.rows[0];

    if (contrato.estado === 'cancelado') throw new Error('No se pueden registrar pagos en un contrato cancelado');
    const saldoPendiente = parseFloat(contrato.saldo_pendiente);

    if (abonar > (saldoPendiente + 0.01)) {
      throw new Error(`El abono (S/ ${abonar.toFixed(2)}) no puede exceder el saldo pendiente (S/ ${saldoPendiente.toFixed(2)})`);
    }

    const sucursalId = req.body.sucursal_id || contrato.sucursal_id || req.user.sucursal_id || 1;
    const metodo = metodo_pago || 'efectivo';
    const mEfctv = monto_efectivo || (metodo === 'efectivo' ? abonar : 0);
    const mYape = monto_yape || (metodo === 'yape' || metodo === 'transferencia' ? abonar : 0);

    // Asiento en Caja Chica
    const cajaRes = await client.query(`
      INSERT INTO movimientos_caja (tipo, concepto, monto, usuario_id, sucursal_id)
      VALUES ('ingreso', $1, $2, $3, $4)
      RETURNING id
    `, [`Abono Óptica ${contrato.codigo_contrato} (${contrato.cliente_nombre})`, abonar, usuarioId, sucursalId]);
    const cajaMovId = cajaRes.rows[0].id;

    // Registro en optica_pagos
    await client.query(`
      INSERT INTO optica_pagos (
        contrato_id, monto, metodo_pago, monto_efectivo, monto_yape,
        usuario_id, sucursal_id, caja_movimiento_id, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      id, abonar, metodo, mEfctv, mYape,
      usuarioId, sucursalId, cajaMovId, notas || ''
    ]);

    // Actualizar saldos del contrato
    const nuevoTotalPagado = parseFloat(contrato.total_pagado) + abonar;
    const nuevoSaldo = Math.max(0, parseFloat(contrato.total) - nuevoTotalPagado);
    const nuevoEstadoPago = nuevoSaldo <= 0.01 ? 'cancelado' : 'parcial';

    await client.query(`
      UPDATE optica_contratos 
      SET total_pagado = $1, saldo_pendiente = $2, estado_pago = $3, updated_at = NOW()
      WHERE id = $4
    `, [nuevoTotalPagado, nuevoSaldo, nuevoEstadoPago, id]);

    // Si ya está 100% pagado (cancelado) Y el trabajo ya está entregado (o se entrega en este acto), generar venta final
    let ventaGeneradaId = contrato.venta_id;
    if (nuevoEstadoPago === 'cancelado' && contrato.estado === 'entregado' && !contrato.venta_id) {
      ventaGeneradaId = await concretarVentaContrato(client, id, req.user);
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('optica:contract_updated', { id });
      io.emit('caja:updated');
    }

    await logActivity(db, usuarioId, 'ABONO_OPTICA_REGISTRADO', `Abono de S/ ${abonar.toFixed(2)} para Contrato ${contrato.codigo_contrato} (Saldo: S/ ${nuevoSaldo.toFixed(2)})`);

    res.json({ 
      success: true, 
      nuevo_total_pagado: nuevoTotalPagado, 
      nuevo_saldo: nuevoSaldo, 
      estado_pago: nuevoEstadoPago,
      venta_id: ventaGeneradaId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/optica/contratos/:id/estado - Actualizar ciclo de vida
router.put('/contratos/:id/estado', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { estado, observaciones, motivo_cancelacion } = req.body;
    const usuarioId = req.user.id;

    const cRes = await client.query('SELECT * FROM optica_contratos WHERE id = $1 FOR UPDATE', [id]);
    if (cRes.rows.length === 0) throw new Error('Contrato no encontrado');
    const contrato = cRes.rows[0];

    const estadoAnterior = contrato.estado;
    if (estadoAnterior === estado) {
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Estado sin cambios' });
    }

    // SI SE CANCELA / ANULA: Restaurar el stock reservado de la montura y accesorios
    if (estado === 'cancelado') {
      if (contrato.montura_tipo === 'inventario_local') {
        if (contrato.montura_variante_id) {
          const curRes = await client.query('SELECT stock_actual FROM inventario_variantes_sucursales WHERE variante_id = $1 AND sucursal_id = $2', [contrato.montura_variante_id, contrato.sucursal_id]);
          const stockAnt = curRes.rows.length > 0 ? parseInt(curRes.rows[0].stock_actual, 10) : 0;

          await client.query(
            'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual + 1 WHERE variante_id = $1 AND sucursal_id = $2',
            [contrato.montura_variante_id, contrato.sucursal_id]
          );
          if (contrato.montura_producto_id) {
            await client.query(
              'UPDATE inventario_sucursales SET stock_actual = stock_actual + 1 WHERE producto_id = $1 AND sucursal_id = $2',
              [contrato.montura_producto_id, contrato.sucursal_id]
            );
          }

          await registrarMovimiento({
            client,
            producto_id: contrato.montura_producto_id,
            variante_id: contrato.montura_variante_id,
            sucursal_id: contrato.sucursal_id,
            usuario_id: usuarioId,
            tipo_movimiento: 'OPTICA_CANCELACION',
            tipo_documento: 'CANCELACION',
            documento_referencia: contrato.codigo_contrato,
            cantidad_entrada: 1,
            stock_anterior: stockAnt,
            stock_saldo: stockAnt + 1,
            motivo: `Cancelación de Contrato ${contrato.codigo_contrato}: ${motivo_cancelacion || observaciones || 'Sin motivo'}`
          });
        } else if (contrato.montura_producto_id) {
          const curRes = await client.query('SELECT stock_actual FROM inventario_sucursales WHERE producto_id = $1 AND sucursal_id = $2', [contrato.montura_producto_id, contrato.sucursal_id]);
          const stockAnt = curRes.rows.length > 0 ? parseInt(curRes.rows[0].stock_actual, 10) : 0;

          await client.query(
            'UPDATE inventario_sucursales SET stock_actual = stock_actual + 1 WHERE producto_id = $1 AND sucursal_id = $2',
            [contrato.montura_producto_id, contrato.sucursal_id]
          );

          await registrarMovimiento({
            client,
            producto_id: contrato.montura_producto_id,
            variante_id: null,
            sucursal_id: contrato.sucursal_id,
            usuario_id: usuarioId,
            tipo_movimiento: 'OPTICA_CANCELACION',
            tipo_documento: 'CANCELACION',
            documento_referencia: contrato.codigo_contrato,
            cantidad_entrada: 1,
            stock_anterior: stockAnt,
            stock_saldo: stockAnt + 1,
            motivo: `Cancelación de Contrato ${contrato.codigo_contrato}: ${motivo_cancelacion || observaciones || 'Sin motivo'}`
          });
        }
      }

      // Restaurar accesorios
      const itemsRes = await client.query(
        'SELECT * FROM optica_contrato_detalles WHERE contrato_id = $1',
        [id]
      );
      for (const it of itemsRes.rows) {
        if (it.tipo_item === 'accesorio' || it.tipo_item === 'repuesto') {
          if (it.variante_id) {
            await client.query(
              'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual + $1 WHERE variante_id = $2 AND sucursal_id = $3',
              [it.cantidad, it.variante_id, contrato.sucursal_id]
            );
          }
          if (it.producto_id) {
            await client.query(
              'UPDATE inventario_sucursales SET stock_actual = stock_actual + $1 WHERE producto_id = $2 AND sucursal_id = $3',
              [it.cantidad, it.producto_id, contrato.sucursal_id]
            );
          }
        }
      }

      await client.query(`
        UPDATE optica_contratos 
        SET estado = 'cancelado', motivo_cancelacion = $1, updated_at = NOW()
        WHERE id = $2
      `, [motivo_cancelacion || observaciones || '', id]);
    } else {
      let extraQuery = '';
      const params = [estado, id];
      if (estado === 'entregado') {
        extraQuery = ', fecha_real_entrega = NOW()';
      }

      await client.query(`
        UPDATE optica_contratos 
        SET estado = $1 ${extraQuery}, updated_at = NOW()
        WHERE id = $2
      `, params);

      // SI PASA A ENTREGADO Y ESTÁ 100% CANCELADO: Generar comprobante comercial oficial
      if (estado === 'entregado' && contrato.estado_pago === 'cancelado' && !contrato.venta_id) {
        await concretarVentaContrato(client, id, req.user);
      }
    }

    // Registrar en auditoría de estados
    await client.query(`
      INSERT INTO optica_historial_estados (contrato_id, estado_anterior, estado_nuevo, usuario_id, observaciones)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, estadoAnterior, estado, usuarioId, observaciones || '']);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit('optica:contract_updated', { id });
      if (estado === 'cancelado') io.emit('stock:changed');
    }

    await logActivity(db, usuarioId, 'ESTADO_OPTICA_MODIFICADO', `Contrato ${contrato.codigo_contrato}: ${estadoAnterior} → ${estado}`);

    res.json({ success: true, estado });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================================================
// RECETAS VISUALES
// ============================================================================

// POST /api/optica/recetas - Guardar receta independiente
router.post('/recetas', async (req, res, next) => {
  try {
    const r = req.body;
    const sucursalId = r.sucursal_id || req.user.sucursal_id || 1;
    const usuarioId = req.user.id;

    const result = await db.query(`
      INSERT INTO optica_recetas (
        cliente_id, sucursal_id, optometrista_id, edad_atencion,
        od_esfera, od_cilindro, od_eje, od_dp,
        oi_esfera, oi_cilindro, oi_eje, oi_dp,
        od_adicion, oi_adicion, od_esfera_cerca, oi_esfera_cerca, od_dp_cerca, oi_dp_cerca,
        tipo_luna, material_luna, tratamientos, color_tinte, indicaciones, observaciones
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24
      ) RETURNING id
    `, [
      r.cliente_id, sucursalId, usuarioId, r.edad_atencion || null,
      r.od_esfera || null, r.od_cilindro || null, r.od_eje || null, r.od_dp || null,
      r.oi_esfera || null, r.oi_cilindro || null, r.oi_eje || null, r.oi_dp || null,
      r.od_adicion || null, r.oi_adicion || null, r.od_esfera_cerca || calcEsferaCercaServer(r.od_esfera, r.od_adicion), r.oi_esfera_cerca || calcEsferaCercaServer(r.oi_esfera, r.oi_adicion),
      r.od_dp_cerca || null, r.oi_dp_cerca || null,
      r.tipo_luna || '', r.material_luna || '', r.tratamientos || '', r.color_tinte || '',
      r.indicaciones || '', r.observaciones || ''
    ]);

    await logActivity(db, usuarioId, 'RECETA_OPTICA_REGISTRADA', `Receta ID ${result.rows[0].id} para cliente ID ${r.cliente_id}`);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// GET /api/optica/recetas/cliente/:clienteId - Historial de recetas del cliente
router.get('/recetas/cliente/:clienteId', async (req, res, next) => {
  try {
    const { clienteId } = req.params;
    const result = await db.query(`
      SELECT r.*, u.nombre as optometrista_nombre, s.nombre as sucursal_nombre
      FROM optica_recetas r
      LEFT JOIN usuarios u ON r.optometrista_id = u.id
      JOIN sucursales s ON r.sucursal_id = s.id
      WHERE r.cliente_id = $1 AND r.activo = true
      ORDER BY r.fecha_medicion DESC
    `, [clienteId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// MONTURAS Y VITRINAS
// ============================================================================

// GET /api/optica/monturas - Catálogo de monturas y vitrinas con stock por sucursal
router.get('/monturas', async (req, res, next) => {
  try {
    const sucursalId = req.query.sucursal_id || req.user.sucursal_id || 1;
    
    // Buscar productos de vitrinas (Vitrina 1, 2, 3, 4) o categoría Lentes/Monturas
    const query = `
      SELECT 
        p.id as producto_id,
        p.codigo as producto_codigo,
        p.nombre as producto_nombre,
        c.nombre as categoria_nombre,
        p.precio_venta as producto_precio,
        p.tiene_variantes,
        v.id as variante_id,
        v.sku as variante_sku,
        v.nombre_variante,
        COALESCE(v.precio_venta, p.precio_venta) as precio_venta,
        CASE 
          WHEN p.tiene_variantes = true THEN COALESCE(ivs.stock_actual, 0)
          ELSE COALESCE(isp.stock_actual, 0)
        END as stock_actual,
        (
          SELECT json_agg(json_build_object(
            'sucursal_id', s.id, 
            'sucursal_nombre', s.nombre,
            'stock_actual', CASE 
              WHEN p.tiene_variantes = true THEN COALESCE((SELECT stock_actual FROM inventario_variantes_sucursales WHERE variante_id = v.id AND sucursal_id = s.id), 0)
              ELSE COALESCE((SELECT stock_actual FROM inventario_sucursales WHERE producto_id = p.id AND sucursal_id = s.id), 0)
            END
          ))
          FROM sucursales s WHERE s.activo = true
        ) as stock_sucursales
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN producto_variantes v ON v.producto_id = p.id AND v.activo = true
      LEFT JOIN inventario_sucursales isp ON isp.producto_id = p.id AND isp.sucursal_id = $1
      LEFT JOIN inventario_variantes_sucursales ivs ON ivs.variante_id = v.id AND ivs.sucursal_id = $1
      WHERE p.activo = true 
        AND (
          p.nombre ILIKE '%Vitrina%' 
          OR p.nombre ILIKE '%Montura%' 
          OR p.nombre ILIKE '%Lente%' 
          OR c.nombre ILIKE '%Vitrina%' 
          OR c.nombre ILIKE '%Lente%'
        )
      ORDER BY p.nombre ASC, v.nombre_variante ASC
    `;

    const result = await db.query(query, [sucursalId]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/optica/buscar-adicional - Buscar accesorios y productos adicionales por código o nombre (soporta JM-VAR-..., JM-PRD-...)
router.get('/buscar-adicional', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const sucursalId = req.query.sucursal_id || req.user.sucursal_id || 1;

    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const term = `%${q}%`;

    // 1. Buscar en producto_variantes (SKU de variante, ej. JM-VAR-xxxxxx, o nombre de variante)
    const varRes = await db.query(`
      SELECT 
        p.id as producto_id,
        p.codigo as producto_codigo,
        p.nombre as producto_nombre,
        c.nombre as categoria_nombre,
        v.id as variante_id,
        v.sku as variante_sku,
        v.sku as codigo,
        v.nombre_variante,
        COALESCE(v.precio_venta, p.precio_venta) as precio_venta,
        COALESCE(ivs.stock_actual, 0) as stock_actual
      FROM producto_variantes v
      JOIN productos p ON v.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario_variantes_sucursales ivs ON v.id = ivs.variante_id AND ivs.sucursal_id = $2
      WHERE v.activo = true AND p.activo = true
        AND (v.sku ILIKE $1 OR v.nombre_variante ILIKE $1 OR p.nombre ILIKE $1 OR p.codigo ILIKE $1)
      ORDER BY 
        CASE 
          WHEN v.sku ILIKE $1 THEN 0 
          WHEN v.nombre_variante ILIKE $1 THEN 1
          ELSE 2 
        END,
        v.nombre_variante ASC
      LIMIT 25
    `, [term, sucursalId]);

    // 2. Buscar en productos simples (sin variantes, ej. JM-PRD-xxxxxx)
    const prodRes = await db.query(`
      SELECT 
        p.id as producto_id,
        p.codigo as producto_codigo,
        p.codigo as codigo,
        p.nombre as producto_nombre,
        c.nombre as categoria_nombre,
        NULL as variante_id,
        NULL as variante_sku,
        '' as nombre_variante,
        p.precio_venta,
        COALESCE(isp.stock_actual, 0) as stock_actual
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario_sucursales isp ON p.id = isp.producto_id AND isp.sucursal_id = $2
      WHERE p.activo = true AND p.tiene_variantes = false
        AND (p.codigo ILIKE $1 OR p.nombre ILIKE $1 OR c.nombre ILIKE $1)
      ORDER BY 
        CASE 
          WHEN p.codigo ILIKE $1 THEN 0 
          ELSE 1 
        END,
        p.nombre ASC
      LIMIT 25
    `, [term, sucursalId]);

    const results = [...varRes.rows, ...prodRes.rows];
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// TRASLADOS ENTRE SUCURSALES
// ============================================================================

// GET /api/optica/traslados - Listado de traslados
router.get('/traslados', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        t.*,
        p.nombre as producto_nombre,
        v.nombre_variante,
        v.sku as variante_sku,
        so.nombre as sucursal_origen_nombre,
        sd.nombre as sucursal_destino_nombre,
        us.nombre as solicitado_por_nombre,
        ua.nombre as autorizado_por_nombre,
        c.codigo_contrato
      FROM optica_traslados_monturas t
      JOIN productos p ON t.producto_id = p.id
      LEFT JOIN producto_variantes v ON t.variante_id = v.id
      JOIN sucursales so ON t.sucursal_origen_id = so.id
      JOIN sucursales sd ON t.sucursal_destino_id = sd.id
      JOIN usuarios us ON t.solicitado_por = us.id
      LEFT JOIN usuarios ua ON t.autorizado_por = ua.id
      LEFT JOIN optica_contratos c ON t.contrato_id = c.id
      ORDER BY t.fecha_solicitud DESC LIMIT 100
    `;
    const result = await db.query(query);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/optica/traslados - Solicitar traslado
router.post('/traslados', async (req, res, next) => {
  try {
    const { contrato_id, producto_id, variante_id, sucursal_origen_id, sucursal_destino_id, notas } = req.body;
    const solicitado_por = req.user.id;

    const result = await db.query(`
      INSERT INTO optica_traslados_monturas (
        contrato_id, producto_id, variante_id,
        sucursal_origen_id, sucursal_destino_id,
        solicitado_por, estado, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, 'solicitado', $7)
      RETURNING id
    `, [contrato_id || null, producto_id, variante_id || null, sucursal_origen_id, sucursal_destino_id, solicitado_por, notas || '']);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// PUT /api/optica/traslados/:id/estado - Cambiar estado traslado
router.put('/traslados/:id/estado', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { estado } = req.body; // 'en_transito', 'recibido', 'devuelto', 'cancelado'
    const usuarioId = req.user.id;

    const tRes = await client.query('SELECT * FROM optica_traslados_monturas WHERE id = $1 FOR UPDATE', [id]);
    if (tRes.rows.length === 0) throw new Error('Traslado no encontrado');
    const traslado = tRes.rows[0];

    let extraQuery = '';
    const params = [estado, usuarioId, id];
    if (estado === 'recibido') {
      extraQuery = ', fecha_recepcion = NOW()';
      // Ajuste de inventario físico entre sucursales
      if (traslado.variante_id) {
        await client.query(
          'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual - 1 WHERE variante_id = $1 AND sucursal_id = $2',
          [traslado.variante_id, traslado.sucursal_origen_id]
        );
        await client.query(
          'UPDATE inventario_variantes_sucursales SET stock_actual = stock_actual + 1 WHERE variante_id = $1 AND sucursal_id = $2',
          [traslado.variante_id, traslado.sucursal_destino_id]
        );

        // Kárdex salida origen
        await registrarMovimiento({
          client,
          producto_id: traslado.producto_id,
          variante_id: traslado.variante_id,
          sucursal_id: traslado.sucursal_origen_id,
          usuario_id: usuarioId,
          tipo_movimiento: 'TRASLADO_SALIDA',
          tipo_documento: 'GUIA_TRASLADO',
          documento_referencia: `TR-${id}`,
          cantidad_salida: 1,
          motivo: `Despacho de traslado hacia sucursal destino`
        });

        // Kárdex entrada destino
        await registrarMovimiento({
          client,
          producto_id: traslado.producto_id,
          variante_id: traslado.variante_id,
          sucursal_id: traslado.sucursal_destino_id,
          usuario_id: usuarioId,
          tipo_movimiento: 'TRASLADO_ENTRADA',
          tipo_documento: 'GUIA_TRASLADO',
          documento_referencia: `TR-${id}`,
          cantidad_entrada: 1,
          motivo: `Recepción de traslado desde sucursal origen`
        });
      } else {
        await client.query(
          'UPDATE inventario_sucursales SET stock_actual = stock_actual - 1 WHERE producto_id = $1 AND sucursal_id = $2',
          [traslado.producto_id, traslado.sucursal_origen_id]
        );
        await client.query(
          'UPDATE inventario_sucursales SET stock_actual = stock_actual + 1 WHERE producto_id = $1 AND sucursal_id = $2',
          [traslado.producto_id, traslado.sucursal_destino_id]
        );

        // Kárdex salida origen
        await registrarMovimiento({
          client,
          producto_id: traslado.producto_id,
          variante_id: null,
          sucursal_id: traslado.sucursal_origen_id,
          usuario_id: usuarioId,
          tipo_movimiento: 'TRASLADO_SALIDA',
          tipo_documento: 'GUIA_TRASLADO',
          documento_referencia: `TR-${id}`,
          cantidad_salida: 1,
          motivo: `Despacho de traslado hacia sucursal destino`
        });

        // Kárdex entrada destino
        await registrarMovimiento({
          client,
          producto_id: traslado.producto_id,
          variante_id: null,
          sucursal_id: traslado.sucursal_destino_id,
          usuario_id: usuarioId,
          tipo_movimiento: 'TRASLADO_ENTRADA',
          tipo_documento: 'GUIA_TRASLADO',
          documento_referencia: `TR-${id}`,
          cantidad_entrada: 1,
          motivo: `Recepción de traslado desde sucursal origen`
        });
      }
    }

    await client.query(`
      UPDATE optica_traslados_monturas 
      SET estado = $1, autorizado_por = $2 ${extraQuery}
      WHERE id = $3
    `, params);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit('stock:changed');

    res.json({ success: true, estado });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================================================
// IMPRESIÓN TÉRMICA & PDF (58mm / 80mm)
// ============================================================================

// GET /api/optica/contratos/:id/ticket - Ticket HTML térmico
router.get('/contratos/:id/ticket', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cRes = await db.query(`
      SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        cl.dni_ruc as cliente_dni_ruc,
        cl.telefono as cliente_telefono,
        u.nombre as usuario_nombre,
        s.nombre as sucursal_nombre
      FROM optica_contratos c
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN sucursales s ON c.sucursal_id = s.id
      WHERE c.id = $1
    `, [id]);

    if (cRes.rows.length === 0) return res.status(404).send('Contrato no encontrado');
    const c = cRes.rows[0];

    const confRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const conf = confRes.rows[0] || {};

    const itemsRes = await db.query('SELECT * FROM optica_contrato_detalles WHERE contrato_id = $1', [id]);
    const items = itemsRes.rows;

    let receta = null;
    if (c.receta_id) {
      const rRes = await db.query('SELECT * FROM optica_recetas WHERE id = $1', [c.receta_id]);
      receta = rRes.rows[0] || null;
    }

    const pagosRes = await db.query('SELECT * FROM optica_pagos WHERE contrato_id = $1 ORDER BY fecha ASC', [id]);
    const pagos = pagosRes.rows;

    // Render HTML ticket
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Orden Óptica ${c.codigo_contrato}</title>
        <style>
          body { font-family: monospace; font-size: 11px; margin: 0; padding: 6px; color: #000; }
          .ticket { width: 100%; max-width: 290px; margin: 0 auto; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th, td { padding: 2px 0; }
          .rx-table th, .rx-table td { text-align: center; border: 1px solid #666; padding: 2px; font-size: 9.5px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <div class="bold" style="font-size: 14px;">${conf.nombre_empresa || 'JOYERÍA & ÓPTICA MARINÉ'}</div>
            <div>${conf.ruc ? `RUC: ${conf.ruc}` : ''}</div>
            <div>${conf.direccion || ''}</div>
            <div>${c.sucursal_nombre}</div>
            <div>Tel: ${conf.telefono || ''}</div>
          </div>
          
          <div class="double-divider"></div>
          <div class="center bold" style="font-size: 12px;">ORDEN DE TRABAJO ÓPTICA</div>
          <div class="center bold">${c.codigo_contrato}</div>
          <div class="divider"></div>

          <div><b>Fecha:</b> ${new Date(c.fecha_contrato).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</div>
          <div><b>Cliente:</b> ${c.cliente_nombre}</div>
          <div><b>Doc:</b> ${c.cliente_dni_ruc || '—'} | <b>Tel:</b> ${c.cliente_telefono || '—'}</div>
          <div><b>Servicio:</b> ${c.tipo_servicio.toUpperCase()}</div>
          <div><b>Atendido por:</b> ${c.usuario_nombre}</div>
    `;

    // Sección Receta Visual
    if (receta) {
      html += `
        <div class="divider"></div>
        <div class="bold center">GRADUACIÓN VISUAL</div>
        <div style="font-size: 9.5px; margin-bottom: 2px;"><b>[ VISIÓN DE LEJOS ]</b></div>
        <table class="rx-table" style="margin-bottom: 4px;">
          <tr><th>Ojo</th><th>Esf</th><th>Cil</th><th>Eje</th><th>Add</th></tr>
          <tr>
            <td><b>OD</b></td>
            <td>${receta.od_esfera !== null ? (receta.od_esfera > 0 ? '+' : '') + receta.od_esfera : '—'}</td>
            <td>${receta.od_cilindro !== null ? (receta.od_cilindro > 0 ? '+' : '') + receta.od_cilindro : '—'}</td>
            <td>${receta.od_eje !== null ? receta.od_eje + '°' : '—'}</td>
            <td>${receta.od_adicion !== null && receta.od_adicion !== undefined ? '+' + receta.od_adicion : '—'}</td>
          </tr>
          <tr>
            <td><b>OI</b></td>
            <td>${receta.oi_esfera !== null ? (receta.oi_esfera > 0 ? '+' : '') + receta.oi_esfera : '—'}</td>
            <td>${receta.oi_cilindro !== null ? (receta.oi_cilindro > 0 ? '+' : '') + receta.oi_cilindro : '—'}</td>
            <td>${receta.oi_eje !== null ? receta.oi_eje + '°' : '—'}</td>
            <td>${receta.oi_adicion !== null && receta.oi_adicion !== undefined ? '+' + receta.oi_adicion : '—'}</td>
          </tr>
        </table>
      `;

      const odCerca = receta.od_esfera_cerca || calcEsferaCercaServer(receta.od_esfera, receta.od_adicion);
      const oiCerca = receta.oi_esfera_cerca || calcEsferaCercaServer(receta.oi_esfera, receta.oi_adicion);

      if (receta.od_adicion || receta.oi_adicion || odCerca || oiCerca) {
        html += `
          <div style="font-size: 9.5px; margin-bottom: 2px;"><b>[ VISIÓN DE CERCA RESULTANTE (Lejos + ADD) ]</b></div>
          <table class="rx-table" style="margin-bottom: 4px;">
            <tr><th>Ojo</th><th>Esf Cerca</th><th>Cil</th><th>Eje</th></tr>
            <tr>
              <td><b>OD</b></td>
              <td><b>${odCerca || '—'}</b></td>
              <td>${receta.od_cilindro !== null ? (receta.od_cilindro > 0 ? '+' : '') + receta.od_cilindro : '—'}</td>
              <td>${receta.od_eje !== null ? receta.od_eje + '°' : '—'}</td>
            </tr>
            <tr>
              <td><b>OI</b></td>
              <td><b>${oiCerca || '—'}</b></td>
              <td>${receta.oi_cilindro !== null ? (receta.oi_cilindro > 0 ? '+' : '') + receta.oi_cilindro : '—'}</td>
              <td>${receta.oi_eje !== null ? receta.oi_eje + '°' : '—'}</td>
            </tr>
          </table>
        `;
      }

      if (receta.tipo_luna || receta.material_luna || receta.tratamientos) {
        html += `
          <div style="font-size: 9.5px; margin-top: 3px;">
            ${receta.tipo_luna ? `<div>• Luna: ${receta.tipo_luna}</div>` : ''}
            ${receta.material_luna ? `<div>• Mat: ${receta.material_luna}</div>` : ''}
            ${receta.tratamientos ? `<div>• Trat: ${receta.tratamientos}</div>` : ''}
          </div>
        `;
      }
    }

    // Detalle de ítems
    html += `
      <div class="divider"></div>
      <div class="bold center">DETALLE DEL TRABAJO</div>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Cant / Descrip</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
    `;
    items.forEach(it => {
      html += `
        <tr>
          <td>${it.cantidad}x ${it.descripcion}</td>
          <td class="right">S/ ${parseFloat(it.subtotal_item).toFixed(2)}</td>
        </tr>
      `;
    });
    html += `
        </tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tr><td>Subtotal:</td><td class="right">S/ ${parseFloat(c.subtotal).toFixed(2)}</td></tr>
        ${c.descuento > 0 ? `<tr><td>Descuento:</td><td class="right">- S/ ${parseFloat(c.descuento).toFixed(2)}</td></tr>` : ''}
        <tr class="bold" style="font-size: 13px;"><td>TOTAL:</td><td class="right">S/ ${parseFloat(c.total).toFixed(2)}</td></tr>
        <tr><td>Total Pagado:</td><td class="right">S/ ${parseFloat(c.total_pagado).toFixed(2)}</td></tr>
        <tr class="bold" style="font-size: 12px; color: ${c.saldo_pendiente > 0 ? '#b91c1c' : '#15803d'}">
          <td>SALDO PENDIENTE:</td>
          <td class="right">S/ ${parseFloat(c.saldo_pendiente).toFixed(2)}</td>
        </tr>
      </table>
    `;

    // Historial de abonos
    if (pagos.length > 0) {
      html += `
        <div class="divider"></div>
        <div class="bold">ABONOS REGISTRADOS:</div>
        <table style="font-size: 9.5px;">
      `;
      pagos.forEach(p => {
        html += `
          <tr>
            <td>${new Date(p.fecha).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })} (${p.metodo_pago})</td>
            <td class="right">S/ ${parseFloat(p.monto).toFixed(2)}</td>
          </tr>
        `;
      });
      html += `</table>`;
    }

    // Entrega y footer
    html += `
      <div class="divider"></div>
      <div><b>Fecha Entrega Estimada:</b> ${c.fecha_estimada_entrega ? new Date(c.fecha_estimada_entrega).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : 'Coordinar con tienda'}</div>
      <div><b>Estado Trabajo:</b> ${c.estado.toUpperCase()}</div>
      ${c.observaciones ? `<div><b>Obs:</b> ${c.observaciones}</div>` : ''}
      <div class="double-divider"></div>
      <div class="center" style="font-size: 9.5px; margin-top: 15px;">
        _______________________________<br>
        Firma del Cliente<br><br>
        <i>Conserve este ticket para el recojo de sus lentes.</i>
      </div>
      <div class="no-print center" style="margin-top: 25px;">
        <button onclick="window.print()" style="padding: 8px 16px; font-weight: bold; cursor: pointer;">Imprimir Ticket</button>
      </div>
      </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /api/optica/recetas/:id/ticket - Ticket de Receta Sola
router.get('/recetas/:id/ticket', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rRes = await db.query(`
      SELECT r.*, cl.nombre as cliente_nombre, cl.dni_ruc as cliente_dni_ruc,
             u.nombre as optometrista_nombre, s.nombre as sucursal_nombre
      FROM optica_recetas r
      JOIN clientes cl ON r.cliente_id = cl.id
      LEFT JOIN usuarios u ON r.optometrista_id = u.id
      JOIN sucursales s ON r.sucursal_id = s.id
      WHERE r.id = $1
    `, [id]);

    if (rRes.rows.length === 0) return res.status(404).send('Receta no encontrada');
    const r = rRes.rows[0];

    const confRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const conf = confRes.rows[0] || {};

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receta Visual #${r.id}</title>
        <style>
          body { font-family: monospace; font-size: 11px; margin: 0; padding: 6px; color: #000; }
          .ticket { width: 100%; max-width: 290px; margin: 0 auto; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .rx-table th, .rx-table td { text-align: center; border: 1px solid #000; padding: 3px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center">
            <div class="bold" style="font-size: 13px;">${conf.nombre_empresa || 'JOYERÍA & ÓPTICA MARINÉ'}</div>
            <div>${r.sucursal_nombre}</div>
          </div>
          <div class="double-divider"></div>
          <div class="center bold" style="font-size: 12px;">PRESCRIPCIÓN VISUAL</div>
          <div class="divider"></div>
          <div><b>Fecha:</b> ${new Date(r.fecha_medicion).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
          <div><b>Paciente:</b> ${r.cliente_nombre}</div>
          <div><b>DNI:</b> ${r.cliente_dni_ruc || '—'} | <b>Edad:</b> ${r.edad_atencion ? r.edad_atencion + ' años' : '—'}</div>
          <div><b>Especialista:</b> ${r.optometrista_nombre || 'Optómetra'}</div>
          <div class="divider"></div>
          
          <div class="bold" style="margin-bottom: 2px;">GRADUACIÓN VISUAL:</div>
          <table class="rx-table" style="margin-bottom: 6px;">
            <tr><th>Ojo</th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th></tr>
            <tr>
              <td><b>OD</b></td>
              <td>${r.od_esfera !== null ? (r.od_esfera > 0 ? '+' : '') + r.od_esfera : '—'}</td>
              <td>${r.od_cilindro !== null ? (r.od_cilindro > 0 ? '+' : '') + r.od_cilindro : '—'}</td>
              <td>${r.od_eje !== null ? r.od_eje + '°' : '—'}</td>
              <td>${r.od_adicion ? '+' + r.od_adicion : '—'}</td>
            </tr>
            <tr>
              <td><b>OI</b></td>
              <td>${r.oi_esfera !== null ? (r.oi_esfera > 0 ? '+' : '') + r.oi_esfera : '—'}</td>
              <td>${r.oi_cilindro !== null ? (r.oi_cilindro > 0 ? '+' : '') + r.oi_cilindro : '—'}</td>
              <td>${r.oi_eje !== null ? r.oi_eje + '°' : '—'}</td>
              <td>${r.oi_adicion ? '+' + r.oi_adicion : '—'}</td>
            </tr>
          </table>

          ${(() => {
            const odC = r.od_esfera_cerca || calcEsferaCercaServer(r.od_esfera, r.od_adicion);
            const oiC = r.oi_esfera_cerca || calcEsferaCercaServer(r.oi_esfera, r.oi_adicion);
            if (r.od_adicion || r.oi_adicion || odC || oiC) {
              return `
                <div class="bold" style="margin-bottom: 2px;">VISIÓN DE CERCA RESULTANTE (Lejos + ADD):</div>
                <table class="rx-table" style="margin-bottom: 6px;">
                  <tr><th>Ojo</th><th>Esf Cerca</th><th>Cilindro</th><th>Eje</th></tr>
                  <tr>
                    <td><b>OD</b></td>
                    <td><b>${odC || '—'}</b></td>
                    <td>${r.od_cilindro !== null ? (r.od_cilindro > 0 ? '+' : '') + r.od_cilindro : '—'}</td>
                    <td>${r.od_eje !== null ? r.od_eje + '°' : '—'}</td>
                  </tr>
                  <tr>
                    <td><b>OI</b></td>
                    <td><b>${oiC || '—'}</b></td>
                    <td>${r.oi_cilindro !== null ? (r.oi_cilindro > 0 ? '+' : '') + r.oi_cilindro : '—'}</td>
                    <td>${r.oi_eje !== null ? r.oi_eje + '°' : '—'}</td>
                  </tr>
                </table>
              `;
            }
            return '';
          })()}

          ${(r.tipo_luna || r.material_luna || r.tratamientos) ? `
            <div class="divider"></div>
            <div class="bold">RECOMENDACIÓN TÉCNICA:</div>
            ${r.tipo_luna ? `<div>• Tipo Luna: ${r.tipo_luna}</div>` : ''}
            ${r.material_luna ? `<div>• Material: ${r.material_luna}</div>` : ''}
            ${r.tratamientos ? `<div>• Tratamientos: ${r.tratamientos}</div>` : ''}
          ` : ''}

          ${r.indicaciones ? `<div style="margin-top: 4px;"><b>Indicaciones:</b> ${r.indicaciones}</div>` : ''}
          ${r.observaciones ? `<div style="margin-top: 2px;"><b>Obs:</b> ${r.observaciones}</div>` : ''}

          <div class="double-divider"></div>
          <div class="center" style="font-size: 9px; margin-top: 20px;">
            _______________________________<br>
            Firma / Sello Optometría
          </div>
          <div class="no-print center" style="margin-top: 20px;">
            <button onclick="window.print()" style="padding: 6px 14px; cursor: pointer;">Imprimir Receta</button>
          </div>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /api/optica/contratos/:id/pdf - Orden de Trabajo en PDFKit
router.get('/contratos/:id/pdf', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cRes = await db.query(`
      SELECT c.*, cl.nombre as cliente_nombre, cl.dni_ruc as cliente_dni_ruc,
             cl.telefono as cliente_telefono, cl.direccion as cliente_direccion,
             u.nombre as usuario_nombre, s.nombre as sucursal_nombre
      FROM optica_contratos c
      JOIN clientes cl ON c.cliente_id = cl.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN sucursales s ON c.sucursal_id = s.id
      WHERE c.id = $1
    `, [id]);

    if (cRes.rows.length === 0) return res.status(404).send('Contrato no encontrado');
    const c = cRes.rows[0];

    const confRes = await db.query('SELECT * FROM config_empresa WHERE id = 1');
    const conf = confRes.rows[0] || {};

    const itemsRes = await db.query('SELECT * FROM optica_contrato_detalles WHERE contrato_id = $1', [id]);
    const items = itemsRes.rows;

    let receta = null;
    if (c.receta_id) {
      const rRes = await db.query('SELECT * FROM optica_recetas WHERE id = $1', [c.receta_id]);
      receta = rRes.rows[0] || null;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Orden_Optica_${c.codigo_contrato}.pdf"`);
    doc.pipe(res);

    // Header
    doc.rect(40, 40, 515, 50).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
       .text(conf.nombre_empresa || 'JOYERÍA & ÓPTICA MARINÉ', 55, 50);
    doc.fillColor('#C59B51').fontSize(9).font('Helvetica')
       .text('ORDEN DE TRABAJO Y CONTRATO DE ÓPTICA', 55, 68);
    doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
       .text(c.codigo_contrato, 400, 55, { align: 'right', width: 140 });

    let y = 105;
    doc.rect(40, y, 515, 50).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold')
       .text('CLIENTE:', 50, y + 6)
       .font('Helvetica').text(c.cliente_nombre, 110, y + 6)
       .font('Helvetica-Bold').text('DNI/RUC:', 50, y + 20)
       .font('Helvetica').text(c.cliente_dni_ruc || '—', 110, y + 20)
       .font('Helvetica-Bold').text('TELÉFONO:', 50, y + 34)
       .font('Helvetica').text(c.cliente_telefono || '—', 110, y + 34);

    doc.font('Helvetica-Bold').text('FECHA ORDEN:', 320, y + 6)
       .font('Helvetica').text(new Date(c.fecha_contrato).toLocaleDateString('es-PE'), 410, y + 6)
       .font('Helvetica-Bold').text('SUCURSAL:', 320, y + 20)
       .font('Helvetica').text(c.sucursal_nombre, 410, y + 20)
       .font('Helvetica-Bold').text('SERVICIO:', 320, y + 34)
       .font('Helvetica').text(c.tipo_servicio.toUpperCase(), 410, y + 34);

    y += 65;
    // Receta visual
    if (receta) {
      doc.fillColor('#800020').fontSize(10).font('Helvetica-Bold').text('GRADUACIÓN VISUAL / PRESCRIPCIÓN', 40, y);
      y += 15;
      doc.rect(40, y, 515, 45).stroke('#CBD5E1');
      doc.fillColor('#0F172A').fontSize(8).font('Helvetica-Bold')
         .text('OJO', 50, y + 5)
         .text('ESFERA (LEJOS)', 110, y + 5)
         .text('CILINDRO', 200, y + 5)
         .text('EJE', 280, y + 5)
         .text('ADICIÓN (ADD)', 345, y + 5)
         .text('ESF. CERCA', 440, y + 5);

      const odCerca = receta.od_esfera_cerca || calcEsferaCercaServer(receta.od_esfera, receta.od_adicion);
      const oiCerca = receta.oi_esfera_cerca || calcEsferaCercaServer(receta.oi_esfera, receta.oi_adicion);

      doc.font('Helvetica')
         .text('OD (Derecho)', 50, y + 18)
         .text(receta.od_esfera !== null ? (receta.od_esfera > 0 ? '+' : '') + receta.od_esfera : '—', 120, y + 18)
         .text(receta.od_cilindro !== null ? (receta.od_cilindro > 0 ? '+' : '') + receta.od_cilindro : '—', 205, y + 18)
         .text(receta.od_eje !== null ? receta.od_eje + '°' : '—', 285, y + 18)
         .text(receta.od_adicion ? '+' + receta.od_adicion : '—', 355, y + 18)
         .font('Helvetica-Bold').text(odCerca || '—', 445, y + 18).font('Helvetica');

      doc.text('OI (Izquierdo)', 50, y + 30)
         .text(receta.oi_esfera !== null ? (receta.oi_esfera > 0 ? '+' : '') + receta.oi_esfera : '—', 120, y + 30)
         .text(receta.oi_cilindro !== null ? (receta.oi_cilindro > 0 ? '+' : '') + receta.oi_cilindro : '—', 205, y + 30)
         .text(receta.oi_eje !== null ? receta.oi_eje + '°' : '—', 285, y + 30)
         .text(receta.oi_adicion ? '+' + receta.oi_adicion : '—', 355, y + 30)
         .font('Helvetica-Bold').text(oiCerca || '—', 445, y + 30).font('Helvetica');

      y += 55;
    }

    // Detalle de ítems
    doc.fillColor('#800020').fontSize(10).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS Y SERVICIOS', 40, y);
    y += 15;
    doc.rect(40, y, 515, 20).fill('#800020');
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
       .text('CANT', 50, y + 5)
       .text('DESCRIPCIÓN', 100, y + 5)
       .text('P. UNIT', 400, y + 5, { align: 'right', width: 60 })
       .text('SUBTOTAL', 470, y + 5, { align: 'right', width: 75 });

    y += 20;
    items.forEach((it, idx) => {
      if (idx % 2 === 1) doc.rect(40, y, 515, 20).fill('#F8FAFC');
      doc.rect(40, y, 515, 20).stroke('#E2E8F0');
      doc.fillColor('#0F172A').fontSize(8).font('Helvetica')
         .text(it.cantidad.toString(), 55, y + 5)
         .text(it.descripcion, 100, y + 5, { width: 290 })
         .text(`S/ ${parseFloat(it.precio_unitario).toFixed(2)}`, 400, y + 5, { align: 'right', width: 60 })
         .text(`S/ ${parseFloat(it.subtotal_item).toFixed(2)}`, 470, y + 5, { align: 'right', width: 75 });
      y += 20;
    });

    // Totales
    y += 10;
    doc.rect(340, y, 215, 60).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold')
       .text('TOTAL GENERAL:', 350, y + 8)
       .text(`S/ ${parseFloat(c.total).toFixed(2)}`, 450, y + 8, { align: 'right', width: 95 })
       .text('TOTAL PAGADO:', 350, y + 24)
       .text(`S/ ${parseFloat(c.total_pagado).toFixed(2)}`, 450, y + 24, { align: 'right', width: 95 });

    doc.fillColor('#B91C1C').fontSize(9.5).font('Helvetica-Bold')
       .text('SALDO PENDIENTE:', 350, y + 42)
       .text(`S/ ${parseFloat(c.saldo_pendiente).toFixed(2)}`, 450, y + 42, { align: 'right', width: 95 });

    // Firmas
    y += 120;
    doc.strokeColor('#94A3B8').lineWidth(1)
       .moveTo(80, y).lineTo(230, y).stroke()
       .moveTo(320, y).lineTo(470, y).stroke();

    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold')
       .text('Firma / Sello Óptica', 80, y + 6, { width: 150, align: 'center' })
       .text('Conformidad del Cliente', 320, y + 6, { width: 150, align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
