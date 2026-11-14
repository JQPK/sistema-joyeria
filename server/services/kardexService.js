const db = require('../config/database');

/**
 * Registra un movimiento físico en el Kárdex de un producto o variante.
 * Puede ejecutarse dentro de una transacción activa pasando `client`.
 */
async function registrarMovimiento(params) {
  const executor = params.client || db;
  const {
    producto_id,
    variante_id = null,
    sucursal_id,
    usuario_id = null,
    tipo_movimiento,
    tipo_documento = null,
    documento_referencia = null,
    cantidad_entrada = 0,
    cantidad_salida = 0,
    motivo = null,
    notas = null
  } = params;

  let stock_anterior = params.stock_anterior;
  let stock_saldo = params.stock_saldo;

  // Si no se pasaron los stocks anterior y saldo, consultarlos
  if (stock_anterior === undefined || stock_saldo === undefined) {
    if (variante_id) {
      const sRes = await executor.query(
        'SELECT stock_actual FROM inventario_variantes_sucursales WHERE variante_id = $1 AND sucursal_id = $2',
        [variante_id, sucursal_id]
      );
      const curr = sRes.rows.length > 0 ? parseInt(sRes.rows[0].stock_actual, 10) : 0;
      if (stock_anterior === undefined) stock_anterior = curr;
      if (stock_saldo === undefined) stock_saldo = curr;
    } else {
      const sRes = await executor.query(
        'SELECT stock_actual FROM inventario_sucursales WHERE producto_id = $1 AND sucursal_id = $2',
        [producto_id, sucursal_id]
      );
      const curr = sRes.rows.length > 0 ? parseInt(sRes.rows[0].stock_actual, 10) : 0;
      if (stock_anterior === undefined) stock_anterior = curr;
      if (stock_saldo === undefined) stock_saldo = curr;
    }
  }

  const query = `
    INSERT INTO kardex_movimientos (
      producto_id, variante_id, sucursal_id, usuario_id,
      tipo_movimiento, tipo_documento, documento_referencia,
      cantidad_entrada, cantidad_salida, stock_anterior, stock_saldo,
      motivo, notas, fecha
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    RETURNING id
  `;

  const res = await executor.query(query, [
    producto_id,
    variante_id,
    sucursal_id,
    usuario_id,
    tipo_movimiento,
    tipo_documento,
    documento_referencia,
    parseInt(cantidad_entrada, 10) || 0,
    parseInt(cantidad_salida, 10) || 0,
    parseInt(stock_anterior, 10) || 0,
    parseInt(stock_saldo, 10) || 0,
    motivo,
    notas
  ]);

  return res.rows[0]?.id;
}

module.exports = { registrarMovimiento };
