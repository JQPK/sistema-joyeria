const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminOnly } = require('../middleware/auth');
const XLSX = require('xlsx');

// Exclusivo para administradores
router.use(auth);
router.use(adminOnly);

// Asegura que la tabla kardex_movimientos y sus dependencias existan
async function ensureKardexTable() {
  try {
    await db.query(`ALTER TABLE detalle_ventas ADD COLUMN IF NOT EXISTS variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL;`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS kardex_movimientos (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
        variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE CASCADE,
        sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
        usuario_id INTEGER REFERENCES usuarios(id),
        fecha TIMESTAMPTZ DEFAULT NOW(),
        tipo_movimiento TEXT NOT NULL,
        tipo_documento TEXT,
        documento_referencia TEXT,
        cantidad_entrada INTEGER NOT NULL DEFAULT 0,
        cantidad_salida INTEGER NOT NULL DEFAULT 0,
        stock_anterior INTEGER NOT NULL DEFAULT 0,
        stock_saldo INTEGER NOT NULL DEFAULT 0,
        motivo TEXT,
        notas TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_kardex_prod ON kardex_movimientos(producto_id, fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_kardex_var ON kardex_movimientos(variante_id, fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_kardex_sucursal ON kardex_movimientos(sucursal_id);
      CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex_movimientos(fecha DESC);
    `);

    // Backfill histórico de ventas si la tabla está vacía
    const countRes = await db.query('SELECT COUNT(*) as total FROM kardex_movimientos');
    if (parseInt(countRes.rows[0]?.total || 0, 10) === 0) {
      await db.query(`
        INSERT INTO kardex_movimientos (
          producto_id, variante_id, sucursal_id, usuario_id, fecha,
          tipo_movimiento, tipo_documento, documento_referencia,
          cantidad_entrada, cantidad_salida, stock_anterior, stock_saldo,
          motivo, notas, created_at
        )
        SELECT 
          dv.producto_id,
          pv.id as variante_id,
          COALESCE(s.id, 1),
          u.id,
          COALESCE(v.fecha, NOW()),
          'VENTA',
          UPPER(COALESCE(v.tipo_comprobante, 'BOLETA')),
          v.numero_comprobante,
          0,
          COALESCE(dv.cantidad, 1),
          0,
          0,
          'Venta en Punto de Venta (Registro histórico)',
          'Cliente: ' || COALESCE(cl.nombre, 'General'),
          COALESCE(v.fecha, NOW())
        FROM detalle_ventas dv
        JOIN productos p ON dv.producto_id = p.id
        JOIN ventas v ON dv.venta_id = v.id
        LEFT JOIN producto_variantes pv ON dv.variante_id = pv.id
        LEFT JOIN sucursales s ON v.sucursal_id = s.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        LEFT JOIN clientes cl ON v.cliente_id = cl.id
        WHERE v.estado = 'completada'
        ORDER BY v.fecha ASC;
      `);
      console.log('[kardex] Backfill inicial completado.');
    }
  } catch (err) {
    console.error('[kardex] Error asegurando tabla kardex_movimientos:', err.message);
  }
}

// Procesa y enriquece los movimientos con saldos progresivos y detalles de ventas
function procesarHistorial(rawMovs, stockActualTotal, producto, variante, sucursalNombreDefault = 'Tienda Principal') {
  // 1. Sumar entradas y salidas de movimientos existentes
  let totalEntradas = 0;
  let totalSalidas = 0;
  let totalAjustes = 0;

  rawMovs.forEach(m => {
    totalEntradas += parseInt(m.cantidad_entrada || 0, 10);
    totalSalidas += parseInt(m.cantidad_salida || 0, 10);
    if (m.tipo_movimiento && m.tipo_movimiento.startsWith('AJUSTE')) {
      totalAjustes++;
    }
  });

  const hasInitial = rawMovs.some(m => m.tipo_movimiento === 'INVENTARIO_INICIAL');
  let movements = [...rawMovs];

  // 2. Si no hay INVENTARIO_INICIAL explícito, calcular y añadir la fila inicial
  if (!hasInitial) {
    const stockInicialCalculado = Math.max(0, stockActualTotal + totalSalidas - totalEntradas);
    const creationDate = (variante ? variante.created_at : producto.created_at) || producto.created_at || new Date().toISOString();

    const initialEntry = {
      id: 'init-0',
      producto_id: producto.id,
      variante_id: variante ? variante.id : null,
      sucursal_id: rawMovs[0]?.sucursal_id || 1,
      fecha: creationDate,
      tipo_movimiento: 'INVENTARIO_INICIAL',
      tipo_documento: 'INVENTARIO_INICIAL',
      documento_referencia: 'CARGA_INICIAL',
      cantidad_entrada: stockInicialCalculado,
      cantidad_salida: 0,
      stock_anterior: 0,
      stock_saldo: stockInicialCalculado,
      motivo: 'Inventario inicial registrado al crear el producto en catálogo',
      notas: 'Carga inicial del sistema',
      usuario_nombre: 'Sistema / Carga Catálogo',
      usuario_username: 'sistema',
      sucursal_nombre: rawMovs[0]?.sucursal_nombre || sucursalNombreDefault,
      nombre_variante: variante ? variante.nombre_variante : null,
      variante_sku: variante ? variante.sku : (producto.codigo || null),
      detalle_operacion: `Creación inicial en catálogo con stock base de ${stockInicialCalculado} unid.`
    };

    movements.unshift(initialEntry);
    totalEntradas += stockInicialCalculado;
  }

  // 3. Recalcular saldos continuos de forma progresiva (cronológica)
  let runningSaldo = 0;
  movements.forEach(m => {
    const ent = parseInt(m.cantidad_entrada || 0, 10);
    const sal = parseInt(m.cantidad_salida || 0, 10);

    m.stock_anterior = runningSaldo;
    runningSaldo = runningSaldo + ent - sal;
    m.stock_saldo = runningSaldo;

    // Enriquecer texto explicativo de la operación
    if (m.tipo_movimiento === 'VENTA') {
      const doc = m.documento_referencia || m.tipo_documento || 'Boleta';
      const usr = m.usuario_nombre ? `${m.usuario_nombre}${m.usuario_username ? ` (${m.usuario_username})` : ''}` : 'Cajero';
      const cln = m.cliente_nombre ? ` · Cliente: ${m.cliente_nombre}` : '';
      const tot = m.venta_total ? ` · S/ ${parseFloat(m.venta_total).toFixed(2)}` : '';
      const met = m.venta_metodo_pago ? ` (${m.venta_metodo_pago})` : '';
      m.detalle_operacion = `Venta en ${m.sucursal_nombre || 'Tienda'} por ${usr} · Doc: ${doc}${cln}${tot}${met}`;
    } else if (m.tipo_movimiento === 'INVENTARIO_INICIAL') {
      m.detalle_operacion = `Creación inicial en catálogo con stock base de ${m.cantidad_entrada} unid.`;
    } else {
      m.detalle_operacion = m.motivo || m.notas || m.tipo_movimiento;
    }
  });

  return {
    movements,
    totalEntradas,
    totalSalidas,
    totalAjustes
  };
}

// GET /api/kardex/producto/:id - Obtener movimientos de kárdex de un producto o subproducto (variante)
router.get('/producto/:id', async (req, res) => {
  try {
    await ensureKardexTable();

    const rawId = parseInt(req.params.id, 10);
    const sucursalId = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? parseInt(req.query.sucursal_id, 10) : null;
    let varianteId = req.query.variante_id ? parseInt(req.query.variante_id, 10) : null;
    const tipoMov = req.query.tipo_movimiento || null;
    const fechaInicio = req.query.fecha_inicio || null;
    const fechaFin = req.query.fecha_fin || null;

    let targetProductoId = rawId;

    // 1. Obtener datos del producto. Si no se encuentra en productos, verificar si es ID de una variante
    let pRes = await db.query(`
      SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN materiales m ON p.material_id = m.id
      WHERE p.id = $1
    `, [targetProductoId]);

    if (pRes.rows.length === 0) {
      const vCheck = await db.query('SELECT * FROM producto_variantes WHERE id = $1', [targetProductoId]);
      if (vCheck.rows.length > 0) {
        varianteId = targetProductoId;
        targetProductoId = vCheck.rows[0].producto_id;
        pRes = await db.query(`
          SELECT p.*, c.nombre as categoria_nombre, m.nombre as material_nombre
          FROM productos p
          LEFT JOIN categorias c ON p.categoria_id = c.id
          LEFT JOIN materiales m ON p.material_id = m.id
          WHERE p.id = $1
        `, [targetProductoId]);
      }
    }

    if (pRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    const producto = pRes.rows[0];

    // 2. Obtener variantes si tiene
    let variantes = [];
    if (producto.tiene_variantes) {
      const vRes = await db.query('SELECT * FROM producto_variantes WHERE producto_id = $1 AND activo = true ORDER BY nombre_variante ASC', [targetProductoId]);
      variantes = vRes.rows;
    }

    const varianteActiva = varianteId ? (variantes.find(v => v.id === varianteId) || null) : null;

    // 3. Stock actual por sucursal
    let stockSucRows = [];
    try {
      let stockQuery;
      let stockParams;

      if (varianteId) {
        stockQuery = `
          SELECT s.id as sucursal_id, s.nombre as sucursal_nombre,
            COALESCE((SELECT stock_actual FROM inventario_variantes_sucursales WHERE variante_id = $1 AND sucursal_id = s.id LIMIT 1), 0) as stock_actual,
            (SELECT stock_original FROM inventario_variantes_sucursales WHERE variante_id = $1 AND sucursal_id = s.id LIMIT 1) as stock_original
          FROM sucursales s
          WHERE s.activo = true
          ORDER BY s.id ASC
        `;
        stockParams = [varianteId];
      } else if (producto.tiene_variantes) {
        stockQuery = `
          SELECT s.id as sucursal_id, s.nombre as sucursal_nombre,
            COALESCE((SELECT SUM(ivs.stock_actual) FROM inventario_variantes_sucursales ivs JOIN producto_variantes pv ON ivs.variante_id = pv.id WHERE pv.producto_id = $1 AND ivs.sucursal_id = s.id), 0) as stock_actual,
            (SELECT SUM(ivs.stock_original) FROM inventario_variantes_sucursales ivs JOIN producto_variantes pv ON ivs.variante_id = pv.id WHERE pv.producto_id = $1 AND ivs.sucursal_id = s.id) as stock_original
          FROM sucursales s
          WHERE s.activo = true
          ORDER BY s.id ASC
        `;
        stockParams = [targetProductoId];
      } else {
        stockQuery = `
          SELECT s.id as sucursal_id, s.nombre as sucursal_nombre,
            COALESCE(isp.stock_actual, 0) as stock_actual,
            isp.stock_original
          FROM sucursales s
          LEFT JOIN inventario_sucursales isp ON isp.producto_id = $1 AND isp.sucursal_id = s.id
          WHERE s.activo = true
          ORDER BY s.id ASC
        `;
        stockParams = [targetProductoId];
      }

      const stockSucRes = await db.query(stockQuery, stockParams);
      stockSucRows = stockSucRes.rows;
    } catch (stockErr) {
      console.error('[kardex] Error en query de stock por sucursal:', stockErr.message);
      stockSucRows = [];
    }

    // 4. Construir consulta de movimientos cronológicos (ASC para cálculo correlativo)
    let rawMovs = [];
    try {
      let query = `
        SELECT 
          km.*,
          u.nombre as usuario_nombre,
          u.username as usuario_username,
          s.nombre as sucursal_nombre,
          pv.nombre_variante,
          pv.sku as variante_sku,
          v.id as venta_id,
          v.total as venta_total,
          v.metodo_pago as venta_metodo_pago,
          cl.nombre as cliente_nombre
        FROM kardex_movimientos km
        LEFT JOIN usuarios u ON km.usuario_id = u.id
        LEFT JOIN sucursales s ON km.sucursal_id = s.id
        LEFT JOIN producto_variantes pv ON km.variante_id = pv.id
        LEFT JOIN ventas v ON km.documento_referencia = v.numero_comprobante
        LEFT JOIN clientes cl ON v.cliente_id = cl.id
        WHERE km.producto_id = $1
      `;
      const params = [targetProductoId];
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

      query += ' ORDER BY km.fecha ASC, km.id ASC LIMIT 500';

      const movRes = await db.query(query, params);
      rawMovs = movRes.rows;
    } catch (movErr) {
      console.error('[kardex] Error en query de movimientos:', movErr.message);
      rawMovs = [];
    }

    const stockActualTotal = stockSucRows.reduce((sum, r) => sum + parseInt(r.stock_actual || 0, 10), 0);
    const { movements, totalEntradas, totalSalidas, totalAjustes } = procesarHistorial(
      rawMovs,
      stockActualTotal,
      producto,
      varianteActiva,
      stockSucRows[0]?.sucursal_nombre
    );

    // Enviar en orden descendente para la vista UI (más reciente primero)
    const movimientosDesc = [...movements].reverse();

    res.json({
      success: true,
      data: {
        producto,
        variantes,
        variante_seleccionada_id: varianteId,
        stock_sucursales: stockSucRows,
        resumen: {
          stock_actual_total: stockActualTotal,
          total_entradas: totalEntradas,
          total_salidas: totalSalidas,
          total_ajustes: totalAjustes,
          total_registros: movements.length
        },
        movimientos: movimientosDesc
      }
    });
  } catch (err) {
    console.error('[kardex] Error general en /producto/:id:', err.message, err.stack);
    res.status(500).json({
      success: false,
      message: 'Error al consultar kárdex: ' + err.message,
      error: err.message
    });
  }
});

// GET /api/kardex/producto/:id/exportar - Exportar Kárdex a Excel
router.get('/producto/:id/exportar', async (req, res) => {
  try {
    await ensureKardexTable();

    const rawId = parseInt(req.params.id, 10);
    const sucursalId = req.query.sucursal_id && req.query.sucursal_id !== 'todas' ? parseInt(req.query.sucursal_id, 10) : null;
    let varianteId = req.query.variante_id ? parseInt(req.query.variante_id, 10) : null;

    let targetProductoId = rawId;
    let pRes = await db.query('SELECT * FROM productos WHERE id = $1', [targetProductoId]);
    if (pRes.rows.length === 0) {
      const vCheck = await db.query('SELECT * FROM producto_variantes WHERE id = $1', [targetProductoId]);
      if (vCheck.rows.length > 0) {
        varianteId = targetProductoId;
        targetProductoId = vCheck.rows[0].producto_id;
        pRes = await db.query('SELECT * FROM productos WHERE id = $1', [targetProductoId]);
      }
    }

    if (pRes.rows.length === 0) return res.status(404).send('Producto no encontrado');
    const prod = pRes.rows[0];

    let varianteActiva = null;
    if (varianteId) {
      const vRes = await db.query('SELECT * FROM producto_variantes WHERE id = $1', [varianteId]);
      varianteActiva = vRes.rows[0] || null;
    }

    // Stock actual
    let stockSucRes;
    if (varianteId) {
      stockSucRes = await db.query('SELECT COALESCE(SUM(stock_actual), 0) as total FROM inventario_variantes_sucursales WHERE variante_id = $1', [varianteId]);
    } else {
      stockSucRes = await db.query('SELECT COALESCE(SUM(stock_actual), 0) as total FROM inventario_sucursales WHERE producto_id = $1', [targetProductoId]);
    }
    const stockActualTotal = parseInt(stockSucRes.rows[0]?.total || 0, 10);

    let query = `
      SELECT 
        km.*,
        u.nombre as usuario_nombre,
        u.username as usuario_username,
        s.nombre as sucursal_nombre,
        pv.nombre_variante,
        v.id as venta_id,
        v.total as venta_total,
        v.metodo_pago as venta_metodo_pago,
        cl.nombre as cliente_nombre
      FROM kardex_movimientos km
      LEFT JOIN usuarios u ON km.usuario_id = u.id
      LEFT JOIN sucursales s ON km.sucursal_id = s.id
      LEFT JOIN producto_variantes pv ON km.variante_id = pv.id
      LEFT JOIN ventas v ON km.documento_referencia = v.numero_comprobante
      LEFT JOIN clientes cl ON v.cliente_id = cl.id
      WHERE km.producto_id = $1
    `;
    const params = [targetProductoId];
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

    const { movements } = procesarHistorial(movRes.rows, stockActualTotal, prod, varianteActiva);

    const dataExcel = movements.map(m => ({
      'Fecha y Hora': new Date(m.fecha).toLocaleString('es-PE'),
      'Tipo Movimiento': m.tipo_movimiento,
      'Variante / Subproducto': m.nombre_variante || '—',
      'Documento': m.tipo_documento || '—',
      'N° Referencia': m.documento_referencia || '—',
      'Tienda / Sucursal': m.sucursal_nombre || 'Principal',
      'Responsable': m.usuario_nombre ? `${m.usuario_nombre}${m.usuario_username ? ` (${m.usuario_username})` : ''}` : 'Sistema',
      'Entrada (+)': m.cantidad_entrada > 0 ? m.cantidad_entrada : 0,
      'Salida (-)': m.cantidad_salida > 0 ? m.cantidad_salida : 0,
      'Stock Anterior': m.stock_anterior,
      'Saldo Resultante': m.stock_saldo,
      'Detalle de la Operación': m.detalle_operacion || m.motivo || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kardex');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Kardex_${(prod.codigo || prod.nombre).replace(/[^a-zA-Z0-9]/g, '_')}${varianteActiva ? `_${varianteActiva.sku}` : ''}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('[kardex] Error exportando excel:', err.message);
    res.status(500).send('Error exportando Kárdex: ' + err.message);
  }
});

module.exports = router;
