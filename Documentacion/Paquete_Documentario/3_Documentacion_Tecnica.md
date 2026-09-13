# 3. Documentación Técnica

## Arquitectura de la Solución
**Modelo:** Cliente-Servidor (SPA en el frontend, API REST en el backend).
**Frontend:** HTML5, CSS3, JavaScript Vanilla (Módulos ES6), empaquetado para Android nativo utilizando Capacitor (WebView).
**Backend:** Node.js con el framework Express.
**Base de Datos:** PostgreSQL 14+.
**Flujo de Datos:** 
El frontend (ya sea corriendo en web o como app Android) realiza peticiones asíncronas a la API Node.js. La base de datos es compartida en tiempo real empleando WebSockets (Socket.io), garantizando que si se realiza una venta en el POS, el stock se actualice inmediatamente en la pantalla de inventario de otros dispositivos conectados.

## Estructura de Carpetas del Proyecto

```text
Sistema de Almacen/
├── android/            # Proyecto nativo de Android generado y gestionado por Capacitor. Contiene código Java/Kotlin y empaqueta la carpeta 'client' en su WebView.
├── client/             # Frontend de la aplicación (SPA Vanilla JS).
│   ├── css/            # Hojas de estilo globales y por componentes.
│   ├── js/
│   │   ├── api.js      # Lógica centralizada para peticiones fetch() y manejo de JWT.
│   │   ├── pages/      # Scripts controladores para cada vista (etiquetas.js, inventario.js, ventas.js, etc).
│   │   ├── components/ # Componentes reutilizables de UI.
│   │   └── app.js      # Archivo de entrada principal de JS y manejo de enrutamiento frontend.
│   ├── plantillas/     # Documentos auxiliares o templates de carga si existen.
│   ├── index.html      # Punto de entrada HTML de la aplicación SPA.
│   └── capacitor.config.json # Configuración de compilación para la App de Android.
├── server/             # Backend de la aplicación (Node.js/Express REST API).
│   ├── config/         # Configuración de base de datos (database.js) y variables globales.
│   ├── middleware/     # Middlewares de Express (ej. auth.js para verificar JWT).
│   ├── migrations/     # Scripts SQL (.sql) para crear las tablas y estructura inicial en PostgreSQL.
│   ├── routes/         # Controladores y rutas de Express (productos.js, ventas.js, variantes.js, etc).
│   ├── scripts/        # Utilidades ejecutables del lado del servidor (ej. read_excel.js para importar data).
│   ├── seeds/          # Datos iniciales para la base de datos (dummy data).
│   ├── services/       # Lógica de negocio o integraciones de terceros.
│   ├── utils/          # Funciones auxiliares genéricas (helpers, logger.js).
│   └── server.js       # Punto de entrada de la aplicación Node, inicialización de Express y Socket.io.
├── tests/              # Archivos de pruebas unitarias o de integración.
├── Documentacion/      # Paquete documentario del proyecto (Negocio, Funcional, QA, Técnica).
└── database/           # Backups de la BD o esquemas (opcional).
```

## Funciones Principales por Capa

### Capa Frontend (Client)
La aplicación frontend está basada en Vanilla JS utilizando un modelo SPA basado en carga asíncrona.
- **Enrutamiento:** Se cambia de página dinámicamente inyectando HTML en un contenedor principal sin recargar la página web.
- **Gestión del Estado:** Cada vista (ej. `inventario.js`) mantiene su estado localmente y se recarga al escuchar eventos de WebSocket (como `stock:changed`).
- **Hardware Integrations:** A través de los plugins de Capacitor, el frontend JS accede a la cámara nativa del teléfono (`@capacitor-mlkit/barcode-scanning`) y a los servicios de impresión de Android (`@bcyesil/capacitor-plugin-printer`).

### Capa Backend (Server)
El backend procesa transacciones concurrentes asegurando integridad de los datos.
- **RESTful API:** Exposición de endpoints bajo `/api/...` para todas las entidades (productos, categorías, usuarios, cajas).
- **Manejo Transaccional (ACID):** Endpoints como el de ventas (`POST /ventas`) usan transacciones SQL (`BEGIN` y `COMMIT`) para garantizar que el stock se reduzca en la misma operación donde se registra la venta, evitando descuadres o concurrencia defectuosa.
- **Socket.io:** Mantiene conexión viva con los clientes Android. Al completarse un PUT o POST exitoso de stock/venta, emite alertas (Broadcasts) para recargar las grillas de inventario y la UI del POS.

## Modelo de Datos (Core)
- **productos:** `id, codigo, nombre, categoria_id, material_id, precio_venta, stock_actual, tiene_variantes`
- **producto_variantes:** `id, producto_id, sku, nombre_variante, precio_venta, stock_actual`
- **ventas:** `id, cliente_id, total, metodo_pago, fecha`
- **venta_detalles:** `id, venta_id, producto_id, variante_id, cantidad, precio_unitario`
- **caja_movimientos:** `id, usuario_id, tipo (ingreso/egreso), monto, motivo`

## Manual de Instalación y Configuración
**Requisitos Backend:**
1. Instalar Node.js v18+ y PostgreSQL 14+.
2. Crear la base de datos en Postgres y ejecutar scripts SQL ubicados en `/server/migrations/`.
3. Renombrar `.env.example` a `.env` e ingresar credenciales de Postgres y la clave secreta de JWT.
4. Ejecutar `npm install` y `node server.js`.

**Requisitos Frontend (Android):**
1. Instalar Android Studio y el SDK nativo de Android.
2. Posicionarse en la raíz del proyecto y ejecutar `npm install` (si hay paquetes compartidos).
3. Sincronizar el directorio `client` hacia `android` ejecutando: `npx cap sync android`.
4. Abrir la carpeta de Android en Android Studio, compilar y ejecutar (Run) apuntando a un dispositivo físico por USB.

## Documentación de APIs Core
- `GET /productos/sku/:sku` - Retorna el producto o variante exacta basada en su código de barras, vital para escaneos en tiempo real en la pantalla de etiquetas e inventario.
- `POST /ventas` - Procesa el carrito de compras. Requiere un payload JSON con detalles, actualiza el log de caja y realiza decremento transaccional del stock en la BD.
- `PUT /variantes/:id` - Actualiza las características de la variante (precio, stock) y emite un evento vía socket (`stock:changed`) informando a todos los clientes.

## Módulos del Sistema vs. Estructura de Archivos

El sistema está organizado de forma modular. Cada "Módulo" del negocio tiene su representación funcional en el frontend (vistas) y en el backend (rutas de API REST). A continuación, se detallan los módulos principales y cómo contrastan con la estructura de archivos físicos:

| Módulo de Negocio | Función Principal | Archivo Frontend (`client/js/pages/`) | Archivo(s) Backend (`server/routes/`) |
|-------------------|-------------------|---------------------------------------|---------------------------------------|
| **Autenticación** | Login, validación de JWT y permisos de usuario. | *(Integrado en `app.js` e `index.html`)* | `auth.js` |
| **Punto de Venta (POS)** | Pantalla de cobro rápida, escaneo de códigos, carrito y medios de pago. | `pos.js` | `ventas.js` |
| **Caja** | Apertura, cierre, ingresos, egresos y cuadre de caja (efectivo/transferencia). | `caja.js` | `caja.js` |
| **Inventario (Almacén)** | Escaneo para ingreso, actualización rápida de stock y precios de productos. | `inventario.js` | `inventario.js` |
| **Gestión de Productos** | Mantenimiento completo (CRUD) de la base de datos de productos y sus variantes. | `productos.js` | `productos.js`, `variantes.js`, `categorias.js`, `materiales.js` |
| **Impresión de Etiquetas** | Generador visual de etiquetas, ajuste por material/categoría y conexión con ticketera. | `etiquetas.js` | *(Consume `productos.js`)* |
| **Clientes** | Registro de clientes para la venta, histórico y fidelización. | `clientes.js` | `clientes.js` |
| **Comprobantes / Facturación** | Gestión de los tickets de venta generados y conexión futura para Facturación (SUNAT). | `comprobantes.js` | *(Depende de `ventas.js` y utilidades)* |
| **Reportes y Dashboard** | Métricas de ventas, rentabilidad, productos más vendidos y alertas de stock bajo. | `dashboard.js`, `reportes.js` | *(Consultas SQL en `ventas.js` y agregadas)* |
| **Usuarios y Permisos** | Creación de roles (Almacén, Cajero, Admin) y control de acceso. | `usuarios.js` | `usuarios.js` |
| **Auditoría (Bitácora)** | Trazabilidad de cada cambio, anulación, ingreso de caja, con usuario y hora. | `bitacora.js` | `actividad.js` |
| **Configuración** | Ajustes generales del negocio, parámetros de impresión y control de licencias. | `configuracion.js` | `config.js`, `licencias.js` |

### Flujo Típico de un Módulo
Un módulo estándar funciona bajo este esquema de archivos:
1. **Frontend (`client/js/pages/modulo.js`)**: Contiene una función `init()` o `load()` que se dispara al abrir la pantalla. Este script se encarga de dibujar el DOM (plantillas de HTML literales), asociar eventos (`addEventListener`) e invocar los endpoints correspondientes de la API.
2. **Backend API (`server/routes/modulo.js`)**: Recibe la petición HTTP (ej. `GET`, `POST`), valida el token JWT vía Middleware, y ejecuta consultas sobre la base de datos PostgreSQL.
3. **Sincronización (Socket.io)**: Si un módulo realiza una operación de escritura importante (ej. `productos.js` creando una nueva variante), el endpoint de backend emite un broadcast (ej. `io.emit('product:updated')`) para que el archivo del frontend de los demás usuarios conectados refresque la pantalla sin necesidad de recargar toda la App.
