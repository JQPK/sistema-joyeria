-- 1. Crear tabla sucursales
CREATE TABLE IF NOT EXISTS sucursales (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar sucursal principal por defecto si no existe
INSERT INTO sucursales (id, nombre, direccion)
SELECT 1, 'Tienda Principal', 'Dirección Principal'
WHERE NOT EXISTS (SELECT 1 FROM sucursales WHERE id = 1);

-- Asegurar que la secuencia esté actualizada si insertamos con ID 1
SELECT setval('sucursales_id_seq', (SELECT MAX(id) FROM sucursales));

-- 2. Crear tablas de inventario por sucursal
CREATE TABLE IF NOT EXISTS inventario_sucursales (
  id SERIAL PRIMARY KEY,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 1,
  UNIQUE(sucursal_id, producto_id)
);

CREATE TABLE IF NOT EXISTS inventario_variantes_sucursales (
  id SERIAL PRIMARY KEY,
  sucursal_id INTEGER NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  variante_id INTEGER NOT NULL REFERENCES producto_variantes(id) ON DELETE CASCADE,
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 1,
  UNIQUE(sucursal_id, variante_id)
);

-- 3. Añadir sucursal_id a usuarios, ventas, caja
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS sucursal_id INTEGER REFERENCES sucursales(id) ON DELETE SET NULL;

-- 4. Asignar sucursal principal (id=1) a registros existentes que no tengan sucursal
UPDATE usuarios SET sucursal_id = 1 WHERE sucursal_id IS NULL;
UPDATE ventas SET sucursal_id = 1 WHERE sucursal_id IS NULL;
UPDATE movimientos_caja SET sucursal_id = 1 WHERE sucursal_id IS NULL;

-- 5. Migrar stock actual de productos a inventario_sucursales
INSERT INTO inventario_sucursales (sucursal_id, producto_id, stock_actual, stock_minimo)
SELECT 1, id, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 1)
FROM productos
ON CONFLICT (sucursal_id, producto_id) DO NOTHING;

-- Migrar stock actual de variantes
INSERT INTO inventario_variantes_sucursales (sucursal_id, variante_id, stock_actual, stock_minimo)
SELECT 1, id, COALESCE(stock_actual, 0), COALESCE(stock_minimo, 1)
FROM producto_variantes
ON CONFLICT (sucursal_id, variante_id) DO NOTHING;
