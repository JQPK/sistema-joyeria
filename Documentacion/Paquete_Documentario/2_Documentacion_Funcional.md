# 2. Documentación Funcional

## Especificación de Requerimientos (SRS)
**Funcionales:**
- RF01: El sistema debe permitir el ingreso de productos agrupados en categorías y materiales.
- RF02: Todo producto debe poder manejar "variantes" que alteren el precio y el stock base.
- RF03: El sistema debe generar y escanear códigos de barras (CODE128).
- RF04: El POS debe procesar ventas múltiples con cálculo de cambio, descuentos y métodos de pago mixtos.
**No Funcionales:**
- RNF01: La interfaz debe ser responsive (adaptada a pantallas de tablet y escritorio).
- RNF02: La impresión de etiquetas debe soportar el formato 76x25mm de forma nativa.

## Historias de Usuario / Épicas
- **Épica 1: Control de Stock:** "Como administrador, quiero gestionar el inventario considerando las variantes (pesos, tallas) para evitar quiebres de stock."
- **Épica 2: Ventas y Caja:** "Como cajero, quiero procesar ventas rápidamente mediante escáner para reducir la fila en tienda."
- **Épica 3: Apartados (Fase 2):** "Como vendedor, quiero reservar una pieza con un pago inicial para asegurar la venta futura."

## Casos de Uso Críticos
**1. Registro de Piezas de Alto Valor:**
- **Actor:** Administrador / Almacenero.
- **Flujo:** Se crea el producto base (ej. "Anillo Compromiso") y se añaden variantes ("Oro 18k - 3 gr", "Oro 14k - 2.5 gr"). El sistema genera SKUs únicos para cada variante.
**2. Control de Concurrencia:**
- **Actor:** Sistema / Cajero.
- **Flujo:** Si dos cajeros intentan vender la misma pieza única simultáneamente, el sistema bloquea la segunda transacción al detectar stock = 0 en el commit de la base de datos.
**3. Apartados y Anticipos:**
- **Flujo:** Se registra una "Venta en Tránsito", el stock se descuenta temporalmente y la caja registra un ingreso parcial.

## Diagrama de Flujo de Procesos (Resumen)
[Proveedor] -> (Ingreso a Almacén) -> (Asignación de SKU y Etiquetado) -> [Exhibición]
[Exhibición] -> (Escaneo en POS) -> (Registro de Venta y Pago) -> (Descuento de Stock y Cierre de Caja) -> [Cliente]

## Matriz de Trazabilidad (Resumen)
- REQ-01 -> CU-01 (Registro) -> CP-01 (Prueba de creación)
- REQ-02 -> CU-02 (Impresión) -> CP-02 (Prueba de escaneo)
