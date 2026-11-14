const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');
const XLSX = require('xlsx');

// Exclusivo para administradores
router.use(auth);
router.use(adminOnly);

// GET /api/kardex/producto/:id - Obtener movimientos de kárdex de un producto
router.get('/producto/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const sucursalId = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? parseInt(req.query.sucursal_id, 10) : null;
    const varianteId = req.query.variante_id ? parseInt(req.query.variante_id, 10) : null;
    const tipoMov = req.query.tipo_movimiento || null;
    const fechaInicio = req.query.fecha_inicio || null;
    const fechaFin = req.query.fecha_fin || null;

    // 1. Obtener datos del producto
    const pRes = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.id = $1
    `, [id]);

    if (pRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    const producto = pRes.rows[0];

    // 2. Obtener variantes si tiene
    let variantes = [];
    if (producto.tiene_variantes) {
      const vRes = await db.query('SELECT * FROM producto_variantes WHERE producto_id = $1 AND activo = true ORDER BY nombre_variante ASC', [id]);
      variantes = vRes.rows;
    }

    // 3. Stock actual por sucursal
    const stockSucRes = await db.query(`
      SELECT s.id as sucursal_id, s.nombre as sucursal_nombre,
        CASE 
          WHEN $2::INTEGER IS NOT NULL THEN (SELECT COALESCE(stock_actual, 0) FROM inventario_variantes_sucursales WHERE variante_id = $2 AND sucursal_id = s.id)
          WHEN $3 = true THEN (SELECT COALESCE(SUM(stock_actual), 0) FROM inventario_variantes_sucursales ivs JOIN producto_variantes pv ON ivs.variante_id = pv.id WHERE pv.producto_id = $1 AND ivs.sucursal_id = s.id)
          ELSE COALESCE(isp.stock_actual, 0)
        END as stock_actual,
        CASE 
          WHEN $2::INTEGER IS NOT NULL THEN (SELECT stock_original FROM inventario_variantes_sucursales WHERE variante_id = $2 AND sucursal_id = s.id)
          WHEN $3 = true THEN (SELECT SUM(stock_original) FROM inventario_variantes_sucursales ivs JOIN producto_variantes pv ON ivs.variante_id = pv.id WHERE pv.producto_id = $1 AND ivs.sucursal_id = s.id)
          ELSE isp.stock_original
        END as stock_original
      FROM sucursales s
      LEFT JOIN inventario_sucursales isp ON isp.producto_id = $1 AND isp.sucursal_id = s.id
      WHERE s.activo = true
      ORDER BY s.id ASC
    `, [id, varianteId, producto.tiene_variantes]);

    // 4. Construir consulta de movimientos en Kárdex
    let query = `
      SELECT 
        km.*,
        u.nombre as usuario_nombre,
        s.nombre as sucursal_nombre,
        pv.nombre_variante,
        pv.sku as variante_sku
      FROM kardex_movimientos km
      LEFT JOIN usuarios u ON km.usuario_id = u.id
      JOIN sucursales s ON km.sucursal_id = s.id
      LEFT JOIN producto_variantes pv ON km.variante_id = pv.id
      WHERE km.producto_id = $1
    `;
    const params = [id];
    let pIdx = 2;

    if (varianteId) {
      query += ` AND km.variante_id = $${pIdx++}`;
      params.push(varianteId);
    }
    if (sucursalId) {
      query += ` AND km.sucursal_id = $${pIdx++}`;
      params.push(sucursalId);
    }
    if (tipoMov) {
      query += ` AND km.tipo_movimiento = $${pIdx++}`;
      params.push(tipoMov);
    }
    if (fechaInicio) {
      query += ` AND km.fecha >= $${pIdx++}`;
      params.push(fechaInicio);
    }
    if (fechaFin) {
      query += ` AND km.fecha <= $${pIdx++}`;
      params.push(fechaFin + ' 23:59:59');
    }

    query += ' ORDER BY km.fecha DESC, km.id DESC LIMIT 300';

    const movRes = await db.query(query, params);
    const movimientos = movRes.rows;

    // 5. Métricas de resumen
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalAjustes = 0;

    movimientos.forEach(m => {
      totalEntradas += parseInt(m.cantidad_entrada || 0, 10);
      totalSalidas += parseInt(m.cantidad_salida || 0, 10);
      if (m.tipo_movimiento && m.tipo_movimiento.startsWith('AJUSTE')) {
        totalAjustes++;
      }
    });

    const stockActualTotal = stockSucRes.rows.reduce((sum, r) => sum + parseInt(r.stock_actual || 0, 10), 0);

    res.json({
      success: true,
      data: {
        producto,
        variantes,
        stock_sucursales: stockSucRes.rows,
        resumen: {
          stock_actual_total: stockActualTotal,
          total_entradas: totalEntradas,
          total_salidas: totalSalidas,
          total_ajustes: totalAjustes,
          total_registros: movimientos.length
        },
        movimientos
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/kardex/producto/:id/exportar - Exportar Kárdex a Excel
router.get('/producto/:id/exportar', async (req, res, next) => {
  try {
    const { id } = req.params;
    const sucursalId = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? parseInt(req.query.sucursal_id, 10) : null;
    const varianteId = req.query.variante_id ? parseInt(req.query.variante_id, 10) : null;

    const pRes = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (pRes.rows.length === 0) return res.status(404).send('Producto no encontrado');
    const prod = pRes.rows[0];

    let query = `
      SELECT 
        km.fecha,
        km.tipo_movimiento,
        km.tipo_documento,
        km.documento_referencia,
        s.nombre as sucursal_nombre,
        u.nombre as usuario_nombre,
        pv.nombre_variante,
        km.cantidad_entrada,
        km.cantidad_salida,
        km.stock_anterior,
        km.stock_saldo,
        km.motivo,
        km.notas
      FROM kardex_movimientos km
      LEFT JOIN usuarios u ON km.usuario_id = u.id
      JOIN sucursales s ON km.sucursal_id = s.id
      LEFT JOIN producto_variantes pv ON km.variante_id = pv.id
      WHERE km.producto_id = $1
    `;
    const params = [id];
    let pIdx = 2;

    if (varianteId) {
      query += ` AND km.variante_id = $${pIdx++}`;
      params.push(varianteId);
    }
    if (sucursalId) {
      query += ` AND km.sucursal_id = $${pIdx++}`;
      params.push(sucursalId);
    }

    query += ' ORDER BY km.fecha ASC, km.id ASC';
    const movRes = await db.query(query, params);

    const dataExcel = movRes.rows.map(m => ({
      'Fecha y Hora': new Date(m.fecha).toLocaleString('es-PE'),
      'Tipo Movimiento': m.tipo_movimiento,
      'Variante': m.nombre_variante || '—',
      'Documento': m.tipo_documento || '—',
      'N° Referencia': m.documento_referencia || '—',
      'Tienda / Sucursal': m.sucursal_nombre,
      'Responsable': m.usuario_nombre || 'Sistema',
      'Entrada (+)': m.cantidad_entrada,
      'Salida (-)': m.cantidad_salida,
      'Stock Anterior': m.stock_anterior,
      'Saldo Resultante': m.stock_saldo,
      'Motivo': m.motivo || '—',
      'Notas': m.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kardex');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Kardex_${(prod.codigo || prod.nombre).replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
