-- =====================================================================
-- MIGRACIÓN 007: MÓDULO INTEGRAL DE ÓPTICA
-- Contratos, Recetas Oftálmicas, Órdenes de Trabajo, Abonos y Traslados
-- Joyería & Óptica Mariné
-- =====================================================================

-- 1. Ampliar tabla clientes con datos de edad y documento
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'DNI';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS edad INTEGER;

-- 2. Recetas visuales independientes
CREATE TABLE IF NOT EXISTS optica_recetas (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
  optometrista_id INTEGER REFERENCES usuarios(id),
  fecha_medicion TIMESTAMPTZ DEFAULT NOW(),
  edad_atencion INTEGER,
  
  -- Visión de Lejos
  od_esfera NUMERIC(5,2),
  od_cilindro NUMERIC(5,2),
  od_eje INTEGER,
  od_dp NUMERIC(4,1),
  
  oi_esfera NUMERIC(5,2),
  oi_cilindro NUMERIC(5,2),
  oi_eje INTEGER,
  oi_dp NUMERIC(4,1),
  
  -- Adición y Cerca (Cerca = Lejos + ADD)
  od_adicion NUMERIC(5,2),
  oi_adicion NUMERIC(5,2),
  od_esfera_cerca NUMERIC(5,2),
  oi_esfera_cerca NUMERIC(5,2),
  od_dp_cerca NUMERIC(4,1),
  oi_dp_cerca NUMERIC(4,1),
  
  -- Especificaciones y Tratamientos de lunas
  tipo_luna TEXT,       -- 'monofocal', 'bifocal', 'progresivo', 'descanso', 'contacto', 'otro'
  material_luna TEXT,   -- 'resina_cr39', 'policarbonato', 'alto_indice', 'vidrio', 'otro'
  tratamientos TEXT,    -- Lista separada por comas: 'antirreflejo,fotocromatico,filtro_azul,uv400'
  color_tinte TEXT,
  indicaciones TEXT,
  observaciones TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Contratos y Órdenes de Trabajo
CREATE TABLE IF NOT EXISTS optica_contratos (
  id SERIAL PRIMARY KEY,
  codigo_contrato TEXT UNIQUE NOT NULL, -- ej. OPT-260001
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  receta_id INTEGER REFERENCES optica_recetas(id) ON DELETE SET NULL,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_servicio TEXT NOT NULL,          -- 'completo', 'cambio_montura', 'reparacion', 'medicion'
  
  -- Datos de la montura física
  montura_tipo TEXT DEFAULT 'inventario_local', -- 'inventario_local', 'inventario_traslado', 'propia_cliente', 'ninguna'
  montura_producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  montura_variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL,
  montura_sucursal_origen_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL,
  montura_descripcion TEXT,
  montura_observaciones_lunas_cliente TEXT,
  
  -- Seguimiento y Fechas
  fecha_contrato TIMESTAMPTZ DEFAULT NOW(),
  fecha_estimada_entrega TIMESTAMPTZ,
  fecha_real_entrega TIMESTAMPTZ,
  responsable_taller TEXT,
  estado TEXT DEFAULT 'registrado',     -- 'borrador', 'registrado', 'pendiente_elaboracion', 'en_elaboracion', 'listo_entrega', 'entregado', 'cancelado'
  motivo_cancelacion TEXT,
  
  -- Económico y Pagos
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_pagado NUMERIC(10,2) DEFAULT 0,
  saldo_pendiente NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado_pago TEXT DEFAULT 'pendiente', -- 'pendiente', 'parcial', 'cancelado', 'reembolsado'
  
  -- Integración con Comprobantes (se llena cuando está cancelado y entregado)
  venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
  
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Detalle de Ítems del Contrato (Comportamiento tipo Carrito)
CREATE TABLE IF NOT EXISTS optica_contrato_detalles (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES optica_contratos(id) ON DELETE CASCADE,
  tipo_item TEXT NOT NULL,              -- 'montura', 'lunas', 'servicio', 'accesorio', 'repuesto'
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  variante_id INTEGER REFERENCES producto_variantes(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  descuento_item NUMERIC(10,2) DEFAULT 0,
  subtotal_item NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- 5. Historial de Pagos y Abonos
CREATE TABLE IF NOT EXISTS optica_pagos (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES optica_contratos(id) ON DELETE CASCADE,
  monto NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo', -- 'efectivo', 'yape', 'tarjeta', 'mixto'
  monto_efectivo NUMERIC(10,2) DEFAULT 0,
  monto_yape NUMERIC(10,2) DEFAULT 0,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id),
  caja_movimiento_id INTEGER REFERENCES movimientos_caja(id) ON DELETE SET NULL,
  notas TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Traslados de Monturas entre Sucursales
CREATE TABLE IF NOT EXISTS optica_traslados_monturas (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES optica_contratos(id) ON DELETE SET NULL,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  variante_id INTEGER REFERENCES producto_variantes(id),
  sucursal_origen_id INTEGER NOT NULL REFERENCES sucursales(id),
  sucursal_destino_id INTEGER NOT NULL REFERENCES sucursales(id),
  solicitado_por INTEGER NOT NULL REFERENCES usuarios(id),
  autorizado_por INTEGER REFERENCES usuarios(id),
  estado TEXT DEFAULT 'solicitado',     -- 'solicitado', 'en_transito', 'recibido', 'devuelto', 'cancelado'
  fecha_solicitud TIMESTAMPTZ DEFAULT NOW(),
  fecha_recepcion TIMESTAMPTZ,
  notas TEXT
);

-- 7. Historial y Auditoría de Estados del Contrato
CREATE TABLE IF NOT EXISTS optica_historial_estados (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER NOT NULL REFERENCES optica_contratos(id) ON DELETE CASCADE,
  estado_anterior TEXT,
  estado_nuevo TEXT NOT NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  observaciones TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Secuencia para correlativo de contratos ópticos
CREATE SEQUENCE IF NOT EXISTS seq_optica_contrato START 1;
