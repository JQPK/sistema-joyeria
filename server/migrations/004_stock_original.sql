-- Añadir stock_original a las tablas de inventario
ALTER TABLE inventario_sucursales 
ADD COLUMN IF NOT EXISTS stock_original INTEGER DEFAULT NULL;

ALTER TABLE inventario_variantes_sucursales 
ADD COLUMN IF NOT EXISTS stock_original INTEGER DEFAULT NULL;
