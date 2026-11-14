-- =====================================================================
-- MIGRACIÓN 008: KÁRDEX FÍSICO OPERATIVO
-- Joyería & Óptica Mariné
-- Trazabilidad cronológica de entradas, salidas y saldos físicos
-- =====================================================================

CREATE TABLE IF NOT EXISTS kardex_movimientos (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE CASCADE,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  
  -- Clasificación del movimiento
  -- 'INVENTARIO_INICIAL', 'VENTA', 'ANULACION_VENTA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 
  -- 'OPTICA_RESERVA', 'OPTICA_CANCELACION', 'TRASLADO_SALIDA', 'TRASLADO_ENTRADA'
  tipo_movimiento TEXT NOT NULL,
  
  -- Documento de sustento
  -- 'BOLETA', 'FACTURA', 'NOTA_VENTA', 'CONTRATO_OPTICA', 'GUIA_TRASLADO', 'CONTEO_FISICO'
  tipo_documento TEXT,
  documento_referencia TEXT,
  
  -- Cantidades y balances físicos
  cantidad_entrada INTEGER NOT NULL DEFAULT 0,
  cantidad_salida INTEGER NOT NULL DEFAULT 0,
  stock_anterior INTEGER NOT NULL DEFAULT 0,
  stock_saldo INTEGER NOT NULL DEFAULT 0,
  
  motivo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices optimizados para consultas veloces
CREATE INDEX IF NOT EXISTS idx_kardex_prod ON kardex_movimientos(producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_kardex_var ON kardex_movimientos(variante_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_kardex_sucursal ON kardex_movimientos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex_movimientos(fecha DESC);

-- =====================================================================
-- BACKFILL HISTÓRICO: Cargar ventas pasadas en kardex si la tabla está vacía
-- =====================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM kardex_movimientos;
  
  IF v_count = 0 THEN
    -- 1. Insertar ventas históricas completadas
    INSERT INTO kardex_movimientos (
      producto_id, variante_id, sucursal_id, usuario_id, fecha,
      tipo_movimiento, tipo_documento, documento_referencia,
      cantidad_entrada, cantidad_salida, stock_anterior, stock_saldo,
      motivo, notas, created_at
    )
    SELECT 
      dv.producto_id,
      dv.variante_id,
      COALESCE(v.sucursal_id, 1),
      v.usuario_id,
      v.fecha,
      'VENTA',
      UPPER(COALESCE(v.tipo_comprobante, 'BOLETA')),
      v.numero_comprobante,
      0,
      dv.cantidad,
      0, -- En histórico se calcula en vista
      0,
      'Venta en Punto de Venta (Registro histórico)',
      'Cliente: ' || COALESCE(cl.nombre, 'General'),
      v.fecha
    FROM detalle_ventas dv
    JOIN ventas v ON dv.venta_id = v.id
    LEFT JOIN clientes cl ON v.cliente_id = cl.id
    WHERE v.estado = 'completada'
    ORDER BY v.fecha ASC;
    
    RAISE NOTICE 'Backfill de ventas históricas completado.';
  END IF;
END $$;
