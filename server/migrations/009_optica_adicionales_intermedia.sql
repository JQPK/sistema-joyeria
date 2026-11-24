-- Migración 009: Campos para visión intermedia y especificación manual de lunas en optica_recetas
ALTER TABLE optica_recetas 
  ADD COLUMN IF NOT EXISTS od_adicion_intermedia NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS oi_adicion_intermedia NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS od_esfera_intermedia NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS oi_esfera_intermedia NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tipo_luna_otro TEXT,
  ADD COLUMN IF NOT EXISTS material_luna_otro TEXT;
