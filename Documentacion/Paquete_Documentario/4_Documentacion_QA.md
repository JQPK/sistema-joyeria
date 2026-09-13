# 4. Documentación de QA (Aseguramiento de Calidad)

## Plan de Pruebas (Test Plan)
**Alcance:** Funcionalidad del POS, Gestión de Inventario, Generación e Impresión de Etiquetas, y Control de Caja.
**Estrategia:** Pruebas Manuales (caja negra) en navegador web y en dispositivo Android físico.
**Criterios de Salida:** Cero defectos críticos (blockers), flujo de venta de principio a fin validado al 100%.

## Casos de Prueba Críticos
- **CP-01 (Stock Negativo):** Añadir al carrito más unidades de las disponibles. 
  - *Resultado Esperado:* El sistema debe bloquear el botón "Procesar" y marcar el ítem en rojo.
- **CP-02 (Concurrencia):** Dos usuarios intentan procesar la misma pieza de stock=1 al mismo tiempo.
  - *Resultado Esperado:* La BD hace rollback en la segunda transacción y muestra error "Stock insuficiente".
- **CP-03 (Variantes):** Crear un producto con 2 variantes, imprimir las etiquetas y escanearlas en el POS.
  - *Resultado Esperado:* El escáner debe cargar el precio, nombre de variante y SKU correcto de la variante específica, no del producto padre.

## Matriz de Trazabilidad QA
- Módulo Ventas -> CP-01, CP-02, CP-04 (Múltiples métodos de pago).
- Módulo Almacén -> CP-03, CP-05 (Búsqueda por material y categoría).

## Plan de Regresión
Cada vez que se introduzca una nueva funcionalidad (ej. Facturación Electrónica), se deberá ejecutar la batería de pruebas core:
1. Flujo completo de Venta.
2. Sincronización de Stock.
3. Apertura y Cierre de Caja.

