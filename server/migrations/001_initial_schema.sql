CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materiales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  material_id INTEGER REFERENCES materiales(id) ON DELETE SET NULL,
  peso_gramos NUMERIC(10,2) DEFAULT 0,
  precio_compra NUMERIC(10,2) DEFAULT 0,
  precio_venta NUMERIC(10,2) NOT NULL,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 1,
  descuento_porcentaje NUMERIC(5,2) DEFAULT 0,
  imagen_path TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  dni_ruc TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  email TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT DEFAULT 'cajero',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  numero_comprobante TEXT UNIQUE,
  tipo_comprobante TEXT DEFAULT 'boleta',
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  descuento NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  metodo_pago TEXT DEFAULT 'efectivo',
  monto_pagado NUMERIC(10,2) DEFAULT 0,
  cambio NUMERIC(10,2) DEFAULT 0,
  notas TEXT DEFAULT '',
  estado TEXT DEFAULT 'completada',
  motivo_anulacion TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detalle_ventas (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL,
  precio_unitario NUMERIC(10,2) NOT NULL,
  descuento_item NUMERIC(10,2) DEFAULT 0,
  subtotal_item NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS historial_precios (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  precio_anterior NUMERIC(10,2),
  precio_nuevo NUMERIC(10,2) NOT NULL,
  fecha_cambio TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_empresa (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nombre_empresa TEXT DEFAULT 'Joyería Mariné',
  ruc TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  moneda_simbolo TEXT DEFAULT 'S/',
  serie_boleta TEXT DEFAULT 'B001',
  serie_factura TEXT DEFAULT 'F001',
  correlativo_boleta INTEGER DEFAULT 0,
  correlativo_factura INTEGER DEFAULT 0,
  mensaje_ticket TEXT DEFAULT '¡Gracias por su compra!',
  printer_ip TEXT DEFAULT '',
  printer_port INTEGER DEFAULT 9100
);

CREATE TABLE IF NOT EXISTS actividad_usuarios (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  accion TEXT NOT NULL,
  detalles TEXT DEFAULT '',
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'egreso')),
  concepto TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  notas TEXT DEFAULT '',
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispositivos (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT DEFAULT '',
  device_model TEXT DEFAULT '',
  os_version TEXT DEFAULT '',
  app_version TEXT DEFAULT '',
  licencia_activa BOOLEAN DEFAULT FALSE,
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  fecha_activacion TIMESTAMPTZ,
  ultimo_acceso TIMESTAMPTZ,
  ip_ultimo_acceso TEXT DEFAULT '',
  activo BOOLEAN DEFAULT TRUE
);
