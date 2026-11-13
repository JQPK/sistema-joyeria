# PROPUESTA TÉCNICA Y ECONÓMICA (PROFORMA)
## SERVICIO DE DESARROLLO E INTEGRACIÓN DEL MÓDULO DE ÓPTICA
### Sistema Integrado de Gestión Comercial — Joyería & Óptica Mariné

---

**Fecha de Emisión:** 10 de noviembre de 2026  
**Válido hasta:** 30 de noviembre de 2026  
**Cliente:** Joyería y Óptica Mariné  
**Responsable Técnico / Desarrollador:** Área de Tecnología y Desarrollo Full-Stack  
**Moneda:** Soles Peruanos (S/)  

---

### 1. RESUMEN DEL SERVICIO

El presente documento formaliza la propuesta técnica y económica para la implementación y acople del **Módulo Especializado de Óptica (Contratos, Recetas Oftálmicas, Órdenes de Trabajo y Abonos)** dentro del sistema web y móvil de Joyería Mariné.

El trabajo comprende la digitalización completa del flujo de atención de óptica:
- Medición de la vista (recetas con cálculo automático de adición y especificación de lunas).
- Integración de monturas de vitrinas físicas respetando el inventario por sucursal.
- Control de abonos y pagos parciales integrados a la Caja Chica diaria.
- Liquidación final y emisión en la vista de Comprobantes una vez cancelado y entregado.
- Adaptación a ticketera térmica (58mm / 80mm) y generación de Orden de Trabajo en PDF.

---

### 2. DETALLE DE ENTREGABLES

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALCANCE DE ENTREGABLES                          │
├────────────────────────────────┬───────────────────────────────────────┤
│ ENTREGABLE 1: Recetas Visuales │ Ficha digital con OD / OI, cálculo    │
│ & Graduación Oftálmica         │ automático de ADD, lunas y tratamientos│
├────────────────────────────────┼───────────────────────────────────────┤
│ ENTREGABLE 2: Contratos &      │ Gestión de 4 servicios: Lentes        │
│ Órdenes de Trabajo             │ completos, cambio montura, reparación │
│                                │ y medición independiente.             │
├────────────────────────────────┼───────────────────────────────────────┤
│ ENTREGABLE 3: Inventario de    │ Vinculación con vitrinas 1, 2, 3 y 4, │
│ Monturas por Sucursal          │ validación de stock y traslados.      │
├────────────────────────────────┼───────────────────────────────────────┤
│ ENTREGABLE 4: Pagos, Abonos    │ Registro de adelantos, saldo pendiente│
│ y Caja Chica                   │ y cuadre en vivo en movimientos_caja. │
├────────────────────────────────┼───────────────────────────────────────┤
│ ENTREGABLE 5: Impresión        │ Ticket térmico (58/80mm), orden PDF y │
│ Térmica & Comprobantes         │ registro comercial en Comprobantes.   │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### 3. PRESUPUESTO ECONÓMICO AJUSTADO

| Ítem | Componente / Funcionalidad | Subtotal (S/) |
| :---: | :--- | :---: |
| **1.0** | **Módulo de Recetas Visuales:** Graduación de Lejos y Cerca (OD / OI), fórmula de Adición automática ($\text{Cerca} = \text{Lejos} + \text{ADD}$), lunas y tratamientos. | S/ 50.00 |
| **2.0** | **Contratos y Órdenes de Trabajo:** Asistente de atención, estados de fabricación (Registrado, En taller, Listo, Entregado) e historial de clientes. | S/ 50.00 |
| **3.0** | **Control de Monturas y Vitrinas:** Validación estricta de stock en Tienda 1 / Tienda 2, prevención de doble venta y carrito de accesorios. | S/ 40.00 |
| **4.0** | **Gestión de Abonos y Caja Chica:** Control de adelantos en fechas distintas, saldo pendiente y cuadre automático con la Caja Chica. | S/ 30.00 |
| **5.0** | **Impresión Térmica y Comprobantes:** Formato de ticket térmico 58mm/80mm, PDF de trabajo y generación automática en la pantalla de Comprobantes. | S/ 30.00 |
| | **INVERSIÓN TOTAL DEL PROYECTO:** | **S/ 200.00** |

---

### 4. FORMA Y CONDICIONES DE PAGO

- **Opción A (Hitos 50% / 50%):**
  - **50% de Adelanto (S/ 100.00):** Para dar inicio al desarrollo y configuración de base de datos.
  - **50% Contra Entrega (S/ 100.00):** Al desplegar el módulo en el servidor y verificar el funcionamiento en tienda.
- **Opción B (Pago Único):**
  - **100% Contra Entrega (S/ 200.00):** A la conformidad del módulo funcionando en producción.

---

### 5. PLAZO DE ENTREGA Y GARANTÍA

- **Tiempo estimado de implementación:** **3 a 5 días hábiles**.
- **Garantía técnica:** Soporte incluido para corrección de cualquier detalle operativo sin costo adicional.
- **Disponibilidad:** Habilitado tanto para perfil **Administrador** como **Cajero**, compatible con Web y App Móvil Android.
