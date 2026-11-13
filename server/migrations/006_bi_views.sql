-- =====================================================================
-- MIGRACIÓN 006: VISTAS OPTIMIZADAS PARA POWER BI (ESQUEMA EN ESTRELLA)
-- Joyería Mariné - Módulo de Inventario, Ventas y Rotación
-- =====================================================================

DROP VIEW IF EXISTS vw_bi_movimientos_ventas CASCADE;
DROP VIEW IF EXISTS vw_bi_ventas_cabecera CASCADE;
DROP VIEW IF EXISTS vw_bi_inventario CASCADE;
DROP VIEW IF EXISTS vw_bi_productos CASCADE;

-- 1. DIMENSIÓN MAESTRA DE PRODUCTOS (100% SKUs ÚNICOS - Relación 1 a Varios)
-- Esta tabla permite que los segmentadores de Categoría, Material y Producto
-- filtren tanto el Inventario como las Ventas simultáneamente.
CREATE OR REPLACE VIEW vw_bi_productos AS
SELECT DISTINCT
    COALESCE(p.codigo, 'P-' || p.id::TEXT) AS sku_codigo,
    p.id AS producto_id,
    NULL::INTEGER AS variante_id,
    p.nombre AS producto_nombre,
    'Único' AS variante_nombre,
    c.nombre AS categoria,
    m.nombre AS material,
    p.precio_compra,
    p.precio_venta,
    p.activo
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN materiales m ON p.material_id = m.id
WHERE p.tiene_variantes = FALSE OR p.tiene_variantes IS NULL

UNION ALL

SELECT DISTINCT
    v.sku AS sku_codigo,
    p.id AS producto_id,
    v.id AS variante_id,
    p.nombre AS producto_nombre,
    v.nombre_variante AS variante_nombre,
    c.nombre AS categoria,
    m.nombre AS material,
    COALESCE(v.precio_compra, p.precio_compra, 0) AS precio_compra,
    COALESCE(v.precio_venta, p.precio_venta) AS precio_venta,
    v.activo
FROM producto_variantes v
JOIN productos p ON v.producto_id = p.id
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN materiales m ON p.material_id = m.id
WHERE p.tiene_variantes = TRUE;


-- 2. FACT INVENTARIO (Incluye clave_sucursal_sku única para cada combinación Tienda-SKU)
CREATE OR REPLACE VIEW vw_bi_inventario AS
-- A) Productos simples
SELECT 
    (s.id::TEXT || '-' || COALESCE(p.codigo, 'P-' || p.id::TEXT)) AS clave_sucursal_sku,
    'PROD-' || p.id::TEXT AS item_uid,
    p.id AS producto_id,
    NULL::INTEGER AS variante_id,
    COALESCE(p.codigo, 'P-' || p.id::TEXT) AS sku_codigo,
    p.nombre AS producto_nombre,
    'Único' AS variante_nombre,
    c.nombre AS categoria,
    m.nombre AS material,
    s.id AS sucursal_id,
    s.nombre AS sucursal_nombre,
    p.precio_compra,
    p.precio_venta,
    COALESCE(inv.stock_actual, p.stock_actual, 0) AS stock_actual,
    COALESCE(inv.stock_minimo, p.stock_minimo, 1) AS stock_minimo,
    inv.stock_original,
    CASE 
        WHEN inv.stock_original IS NOT NULL AND inv.stock_original > COALESCE(inv.stock_actual, p.stock_actual, 0)
        THEN (inv.stock_original - COALESCE(inv.stock_actual, p.stock_actual, 0))
        ELSE 0 
    END AS huecos_vendidos,
    (COALESCE(inv.stock_actual, p.stock_actual, 0) * p.precio_venta) AS valor_stock_venta,
    (COALESCE(inv.stock_actual, p.stock_actual, 0) * p.precio_compra) AS valor_stock_costo,
    CASE 
        WHEN COALESCE(inv.stock_actual, p.stock_actual, 0) <= 0 THEN 'Agotado'
        WHEN COALESCE(inv.stock_actual, p.stock_actual, 0) <= COALESCE(inv.stock_minimo, p.stock_minimo, 1) THEN 'Bajo Mínimo'
        ELSE 'Óptimo'
    END AS estado_stock,
    CASE 
        WHEN COALESCE(inv.stock_actual, p.stock_actual, 0) <= COALESCE(inv.stock_minimo, p.stock_minimo, 1) THEN 1 
        ELSE 0 
    END AS es_alerta_minimo,
    p.activo
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN materiales m ON p.material_id = m.id
CROSS JOIN sucursales s
LEFT JOIN inventario_sucursales inv ON inv.producto_id = p.id AND inv.sucursal_id = s.id
WHERE p.tiene_variantes = FALSE OR p.tiene_variantes IS NULL

UNION ALL

-- B) Variantes de productos
SELECT 
    (s.id::TEXT || '-' || v.sku) AS clave_sucursal_sku,
    'VAR-' || v.id::TEXT AS item_uid,
    p.id AS producto_id,
    v.id AS variante_id,
    v.sku AS sku_codigo,
    p.nombre AS producto_nombre,
    v.nombre_variante AS variante_nombre,
    c.nombre AS categoria,
    m.nombre AS material,
    s.id AS sucursal_id,
    s.nombre AS sucursal_nombre,
    COALESCE(v.precio_compra, p.precio_compra, 0) AS precio_compra,
    COALESCE(v.precio_venta, p.precio_venta) AS precio_venta,
    COALESCE(inv_v.stock_actual, v.stock_actual, 0) AS stock_actual,
    COALESCE(inv_v.stock_minimo, v.stock_minimo, 1) AS stock_minimo,
    inv_v.stock_original,
    CASE 
        WHEN inv_v.stock_original IS NOT NULL AND inv_v.stock_original > COALESCE(inv_v.stock_actual, v.stock_actual, 0)
        THEN (inv_v.stock_original - COALESCE(inv_v.stock_actual, v.stock_actual, 0))
        ELSE 0 
    END AS huecos_vendidos,
    (COALESCE(inv_v.stock_actual, v.stock_actual, 0) * COALESCE(v.precio_venta, p.precio_venta)) AS valor_stock_venta,
    (COALESCE(inv_v.stock_actual, v.stock_actual, 0) * COALESCE(v.precio_compra, p.precio_compra, 0)) AS valor_stock_costo,
    CASE 
        WHEN COALESCE(inv_v.stock_actual, v.stock_actual, 0) <= 0 THEN 'Agotado'
        WHEN COALESCE(inv_v.stock_actual, v.stock_actual, 0) <= COALESCE(inv_v.stock_minimo, v.stock_minimo, 1) THEN 'Bajo Mínimo'
        ELSE 'Óptimo'
    END AS estado_stock,
    CASE 
        WHEN COALESCE(inv_v.stock_actual, v.stock_actual, 0) <= COALESCE(inv_v.stock_minimo, v.stock_minimo, 1) THEN 1 
        ELSE 0 
    END AS es_alerta_minimo,
    v.activo
FROM producto_variantes v
JOIN productos p ON v.producto_id = p.id
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN materiales m ON p.material_id = m.id
CROSS JOIN sucursales s
LEFT JOIN inventario_variantes_sucursales inv_v ON inv_v.variante_id = v.id AND inv_v.sucursal_id = s.id
WHERE p.tiene_variantes = TRUE;


-- 3. FACT MOVIMIENTOS Y VENTAS (Con clave_sucursal_sku para vincular directo con inventario)
CREATE OR REPLACE VIEW vw_bi_movimientos_ventas AS
SELECT 
    dv.id AS detalle_id,
    v.id AS venta_id,
    (COALESCE(v.sucursal_id, 1)::TEXT || '-' || COALESCE(var.sku, p.codigo, 'P-' || p.id::TEXT)) AS clave_sucursal_sku,
    v.numero_comprobante,
    v.tipo_comprobante,
    v.fecha AS fecha_hora,
    v.fecha::DATE AS fecha,
    EXTRACT(YEAR FROM v.fecha)::INTEGER AS anio,
    EXTRACT(MONTH FROM v.fecha)::INTEGER AS mes_numero,
    TO_CHAR(v.fecha, 'TMMonth') AS mes_nombre,
    TO_CHAR(v.fecha, 'YYYY-MM') AS anio_mes,
    COALESCE(v.sucursal_id, 1) AS sucursal_id,
    COALESCE(s.nombre, 'Tienda Principal') AS sucursal_nombre,
    u.nombre AS vendedor,
    COALESCE(cl.nombre, 'Cliente General') AS cliente_nombre,
    v.metodo_pago,
    v.monto_efectivo,
    v.monto_yape,
    p.id AS producto_id,
    dv.variante_id,
    COALESCE(var.sku, p.codigo, 'P-' || p.id::TEXT) AS sku_codigo,
    p.nombre AS producto_nombre,
    COALESCE(var.nombre_variante, 'Único') AS variante_nombre,
    c.nombre AS categoria,
    m.nombre AS material,
    dv.cantidad,
    dv.precio_unitario,
    dv.descuento_item,
    dv.subtotal_item,
    v.estado
FROM detalle_ventas dv
JOIN ventas v ON dv.venta_id = v.id
JOIN productos p ON dv.producto_id = p.id
LEFT JOIN producto_variantes var ON dv.variante_id = var.id
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN materiales m ON p.material_id = m.id
LEFT JOIN sucursales s ON v.sucursal_id = s.id
LEFT JOIN usuarios u ON v.usuario_id = u.id
LEFT JOIN clientes cl ON v.cliente_id = cl.id
WHERE v.estado = 'completada';


-- 4. CABECERA DE VENTAS
CREATE OR REPLACE VIEW vw_bi_ventas_cabecera AS
SELECT 
    v.id AS venta_id,
    v.numero_comprobante,
    v.tipo_comprobante,
    v.fecha::DATE AS fecha,
    v.fecha AS fecha_hora,
    EXTRACT(YEAR FROM v.fecha)::INTEGER AS anio,
    EXTRACT(MONTH FROM v.fecha)::INTEGER AS mes,
    TO_CHAR(v.fecha, 'YYYY-MM') AS anio_mes,
    COALESCE(v.sucursal_id, 1) AS sucursal_id,
    COALESCE(s.nombre, 'Tienda Principal') AS sucursal_nombre,
    u.nombre AS vendedor,
    COALESCE(cl.nombre, 'Cliente General') AS cliente,
    v.metodo_pago,
    COALESCE(v.monto_efectivo, CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE 0 END) AS monto_efectivo,
    COALESCE(v.monto_yape, CASE WHEN v.metodo_pago IN ('yape', 'transferencia') THEN v.total ELSE 0 END) AS monto_yape,
    v.subtotal,
    v.descuento,
    v.total AS venta_neta,
    v.estado
FROM ventas v
LEFT JOIN sucursales s ON v.sucursal_id = s.id
LEFT JOIN usuarios u ON v.usuario_id = u.id
LEFT JOIN clientes cl ON v.cliente_id = cl.id
WHERE v.estado = 'completada';
