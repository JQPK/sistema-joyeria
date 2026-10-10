-- Agregar columnas para desglose de pago cruzado
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monto_yape     NUMERIC(10,2) DEFAULT NULL;
