# 5. Documentación de Salida a Producción y Usuario Final

## Manual de Usuario y Guía Rápida
- **Cajeros:** Guía de 1 página sobre cómo abrir caja, escanear artículos, procesar el cobro múltiple (efectivo + yape) y cerrar turno.
- **Almacén:** Guía paso a paso sobre cómo registrar productos nuevos, crear variantes (peso/medida) e imprimir los adhesivos con la ticketera térmica.
- **Administrador:** Guía sobre cómo visualizar reportes, anular ventas y auditar la caja chica.

## Plan de Migración de Datos
1. Exportar el inventario actual de Excel a un formato CSV estandarizado (Nombre, Categoría, Material, Peso, Precio, Stock, SKU).
2. Ejecutar el script \/server/scripts/read_excel.js\ (modificado) para insertar masivamente en la base de datos PostgreSQL, generando automáticamente SKUs para productos sin código.

## Plan de Rollback / Contingencia
**Si el sistema falla en pleno horario comercial:**
1. Los cajeros deben pasar al "Modo Offline Manual" (registro en talonario físico con códigos SKU anotados a mano).
2. Se escalará el incidente a soporte técnico nivel 2.
3. Al restablecer el sistema, el administrador ingresará el talonario mediante la función de "Venta Retroactiva".

## Política de Seguridad y Accesos
Debido al alto valor del inventario (joyas), los roles son estrictos:
- **Rol CAJERO:** Solo puede vender, ver stock y hacer ingresos/egresos de caja. NO puede borrar productos, modificar precios base ni ver costos de compra.
- **Rol ALMACÉN:** Puede crear productos, etiquetas y hacer ingresos de mercadería. NO puede ver el módulo de caja ni procesar ventas.
- **Rol GERENCIA:** Acceso total (reportes, costos, utilidades, borrado lógico de productos). 
Todo movimiento de stock u operación de eliminación deja registro en la tabla \ctividad_log\.
