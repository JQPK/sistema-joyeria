CREATE TABLE IF NOT EXISTS producto_variantes (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  nombre_variante TEXT NOT NULL,
  atributo_1_nombre TEXT DEFAULT '',
  atributo_1_valor TEXT DEFAULT '',
  atributo_2_nombre TEXT DEFAULT '',
  atributo_2_valor TEXT DEFAULT '',
  precio_venta NUMERIC(10,2),
  precio_compra NUMERIC(10,2),
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 1,
  peso_gramos NUMERIC(10,2) DEFAULT 0,
  imagen_path TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS tiene_variantes BOOLEAN DEFAULT FALSE;
