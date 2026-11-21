import { api, API_URL } from '../api.js';
import { auth } from '../auth.js';
import { scanner } from '../scanner.js';

export default {
  container: null,
  activeTab: 'contratos',
  contratos: [],
  recetas: [],
  traslados: [],
  monturasCatalogo: [],
  todosLosProductos: [],
  clientesCache: [],
  sucursales: [],
  
  // Estado reactivo para la Nueva Atención / Wizard
  nuevoContrato: {
    cliente: null,
    tipo_servicio: 'completo', // 'completo', 'cambio_montura', 'reparacion', 'medicion'
    receta_id: null,
    receta: {
      od_esfera: '',
      od_cilindro: '',
      od_eje: '',
      od_dp: '',
      oi_esfera: '',
      oi_cilindro: '',
      oi_eje: '',
      oi_dp: '',
      od_adicion: '',
      oi_adicion: '',
      od_esfera_cerca: '',
      oi_esfera_cerca: '',
      od_dp_cerca: '',
      oi_dp_cerca: '',
      tipo_luna: 'monofocal',
      material_luna: 'resina_cr39',
      tratamientos: [],
      color_tinte: '',
      indicaciones: '',
      observaciones: ''
    },
    montura_tipo: 'inventario_local', // 'inventario_local', 'inventario_traslado', 'propia_cliente', 'ninguna'
    montura_producto_id: null,
    montura_variante_id: null,
    montura_sucursal_origen_id: null,
    montura_descripcion: '',
    montura_precio: 0,
    montura_stock_actual: 0,
    montura_observaciones_lunas_cliente: '',
    costo_montaje: 0,
    precio_lunas: 0,
    precio_reparacion: 0,
    descripcion_reparacion: '',
    descuento: 0,
    monto_adelanto: 0,
    metodo_pago: 'efectivo',
    monto_efectivo: 0,
    monto_yape: 0,
    fecha_estimada_entrega: '',
    responsable_taller: '',
    observaciones: '',
    productos_adicionales: []
  },

  async init(container) {
    this.container = container;
    this.renderLayout();
    this.bindEvents();
    this.loadSucursales();
    await this.loadContratos();
  },

  load() {
    this.setupWindowGlobals();
    if (this.activeTab === 'contratos') this.loadContratos();
    else if (this.activeTab === 'recetas') this.loadRecetas();
    else if (this.activeTab === 'traslados') this.loadTraslados();
  },

  setupWindowGlobals() {
    window.optica = this;
    window.opticaSwitchTab = (tab) => this.switchTab(tab);
    window.opticaVerContrato = (id) => this.verDetalleContrato(id);
    window.opticaAbonar = (id) => this.abrirModalAbono(id);
    window.opticaCambiarEstado = (id) => this.abrirModalEstado(id);
    window.opticaPrintTicket = (id) => this.imprimirTicketContrato(id);
    window.opticaPrintReceta = (id) => this.imprimirTicketReceta(id);
    window.opticaPdfContrato = (id) => this.abrirPdfContrato(id);
    window.opticaCrearContratoDesdeReceta = (recetaId, clienteId) => this.crearContratoDesdeReceta(recetaId, clienteId);
  },

  renderLayout() {
    this.container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem">
        <div class="card-header flex justify-between items-center" style="flex-wrap: wrap; gap: 0.75rem">
          <div class="flex items-center" style="gap: 0.75rem">
            <div style="background: var(--accent-gold-light); width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold-dark)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px">
                <circle cx="6" cy="14" r="4"></circle>
                <circle cx="18" cy="14" r="4"></circle>
                <line x1="10" y1="14" x2="14" y2="14"></line>
                <path d="M2 14l3-7h2"></path>
                <path d="M22 14l-3-7h-2"></path>
              </svg>
            </div>
            <div>
              <h2 class="text-gold" style="margin: 0; font-size: 1.4rem">Módulo de Óptica</h2>
              <small class="text-muted">Contratos, recetas oftálmicas, órdenes de taller y entrega</small>
            </div>
          </div>
          <div class="flex" style="gap: 0.5rem">
            <button class="btn btn-primary" onclick="window.opticaSwitchTab('nueva-atencion')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Nueva Atención
            </button>
          </div>
        </div>

        <!-- Barra de Pestañas Principales -->
        <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--bg-secondary); padding: 0 1rem; overflow-x: auto; background: var(--bg-primary)">
          <button id="optica-tab-btn-contratos" class="optica-nav-tab active" onclick="window.opticaSwitchTab('contratos')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            Contratos y Órdenes
            <span id="badge-contador-contratos" class="badge badge-gold" style="font-size:0.7rem; margin-left:4px">0</span>
          </button>
          <button id="optica-tab-btn-nueva-atencion" class="optica-nav-tab" onclick="window.opticaSwitchTab('nueva-atencion')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nueva Atención / Wizard
          </button>
          <button id="optica-tab-btn-recetas" class="optica-nav-tab" onclick="window.opticaSwitchTab('recetas')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Historial de Recetas
          </button>
          <button id="optica-tab-btn-traslados" class="optica-nav-tab" onclick="window.opticaSwitchTab('traslados')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            Traslado de Monturas
          </button>
        </div>

        <div class="card-body" style="padding: 1.25rem">
          <!-- PESTAÑA 1: CONTRATOS Y ÓRDENES -->
          <div id="optica-view-contratos" class="optica-view">
            <!-- Métricas Resumen -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem">
              <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 1rem; box-shadow: var(--shadow-sm)">
                <div class="text-muted" style="font-size:0.8rem; font-weight:600">TOTAL CONTRATOS</div>
                <div id="stat-total-contratos" class="text-gold" style="font-size:1.6rem; font-weight:700">0</div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Órdenes registradas</div>
              </div>
              <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 1rem; box-shadow: var(--shadow-sm)">
                <div class="text-muted" style="font-size:0.8rem; font-weight:600">EN TALLER / PROCESO</div>
                <div id="stat-en-taller" style="font-size:1.6rem; font-weight:700; color:#3b82f6">0</div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">En elaboración</div>
              </div>
              <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 1rem; box-shadow: var(--shadow-sm)">
                <div class="text-muted" style="font-size:0.8rem; font-weight:600">LISTOS PARA ENTREGA</div>
                <div id="stat-listos" style="font-size:1.6rem; font-weight:700; color:#10b981">0</div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Por entregar al cliente</div>
              </div>
              <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 1rem; box-shadow: var(--shadow-sm)">
                <div class="text-muted" style="font-size:0.8rem; font-weight:600">CON SALDO PENDIENTE</div>
                <div id="stat-con-saldo" style="font-size:1.6rem; font-weight:700; color:var(--color-danger)">0</div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Abonos parciales o S/ 0</div>
              </div>
            </div>

            <!-- Filtros de Búsqueda -->
            <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--border-radius-md); margin-bottom: 1rem; border: 1px solid var(--bg-secondary)">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; align-items: flex-end">
                <div class="form-group mb-0" style="grid-column: span 2">
                  <label class="form-label">Buscar Contrato</label>
                  <input type="text" id="filtro-optica-search" class="form-control" placeholder="Buscar por código (OPT-...), cliente, DNI o teléfono...">
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Estado de Taller</label>
                  <select id="filtro-optica-estado" class="form-control">
                    <option value="">Todos los estados</option>
                    <option value="registrado">Registrado</option>
                    <option value="pendiente_elaboracion">Pendiente Laboratorio</option>
                    <option value="en_elaboracion">En Elaboración / Taller</option>
                    <option value="listo_entrega">Listo para Entrega</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Estado de Pago</label>
                  <select id="filtro-optica-estado-pago" class="form-control">
                    <option value="">Todos los pagos</option>
                    <option value="pendiente">Pendiente (S/ 0)</option>
                    <option value="parcial">Pago Parcial / Adelanto</option>
                    <option value="cancelado">100% Cancelado</option>
                  </select>
                </div>
                <div class="form-group mb-0">
                  <label class="form-label">Tipo de Servicio</label>
                  <select id="filtro-optica-tipo-servicio" class="form-control">
                    <option value="">Todos los servicios</option>
                    <option value="completo">Contrato Completo</option>
                    <option value="cambio_montura">Cambio de Montura</option>
                    <option value="reparacion">Reparación</option>
                    <option value="medicion">Medición Sola</option>
                  </select>
                </div>
                <div class="form-group mb-0" style="display:flex; align-items:center; gap:0.5rem; height: 42px">
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.85rem; font-weight:600">
                    <input type="checkbox" id="filtro-optica-pendientes" checked>
                    Solo pendientes de entrega
                  </label>
                </div>
                <div class="form-group mb-0">
                  <button class="btn btn-secondary w-full" onclick="window.optica.loadContratos()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:4px"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            </div>

            <!-- Tabla de Contratos -->
            <div class="table-responsive">
              <table class="data-table" id="tabla-contratos-optica">
                <thead>
                  <tr>
                    <th>Código / Servicio</th>
                    <th>Cliente</th>
                    <th>Montura / Detalle</th>
                    <th>Fecha / Prometida</th>
                    <th>Total y Saldo</th>
                    <th>Estado Taller</th>
                    <th>Pago</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tbody-contratos-optica">
                  <tr><td colspan="8" class="text-center text-muted" style="padding: 2rem">Cargando contratos...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PESTAÑA 2: NUEVA ATENCIÓN / WIZARD -->
          <div id="optica-view-nueva-atencion" class="optica-view hidden">
            <div id="wizard-container" style="max-width: 950px; margin: 0 auto">
              <!-- PASO 1: CLIENTE -->
              <div class="card" style="margin-bottom: 1.25rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex justify-between items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary)">
                  <div class="flex items-center" style="gap: 0.5rem">
                    <span style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">1</span>
                    <h3 style="margin: 0; font-size: 1.1rem">Datos del Cliente y Paciente</h3>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.optica.abrirModalNuevoCliente()">
                    + Registrar Nuevo Cliente
                  </button>
                </div>
                <div class="card-body">
                  <div id="box-cliente-busqueda">
                    <label class="form-label">Buscar Cliente Existente (Nombre, DNI o Teléfono)</label>
                    <div style="position: relative">
                      <input type="text" id="wizard-cliente-input" class="form-control" placeholder="Escribe para buscar cliente..." autocomplete="off">
                      <div id="wizard-cliente-resultados" class="hidden" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid var(--bg-tertiary); border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); z-index: 1000; max-height: 220px; overflow-y: auto"></div>
                    </div>
                  </div>

                  <!-- Ficha de Cliente Seleccionado -->
                  <div id="box-cliente-seleccionado" class="hidden" style="margin-top: 0.75rem; background: var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius-md); border-left: 4px solid var(--accent-gold)">
                    <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 0.5rem">
                      <div>
                        <div id="w-clie-nombre" style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary)">-</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 4px">
                          <span><strong>Documento:</strong> <span id="w-clie-doc">-</span></span>
                          <span><strong>Teléfono:</strong> <span id="w-clie-tel">-</span></span>
                          <span><strong>Edad al momento:</strong> <span id="w-clie-edad">-</span></span>
                        </div>
                      </div>
                      <div class="flex" style="gap: 0.5rem">
                        <button type="button" id="btn-cargar-ultima-receta" class="btn btn-secondary btn-sm hidden" onclick="window.optica.cargarUltimaRecetaCliente()">
                          ⚡ Cargar Última Receta
                        </button>
                        <button type="button" class="btn btn-icon btn-sm" title="Cambiar cliente" onclick="window.optica.deseleccionarCliente()">
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- PASO 2: TIPO DE SERVICIO -->
              <div class="card" style="margin-bottom: 1.25rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary); gap: 0.5rem">
                  <span style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">2</span>
                  <h3 style="margin: 0; font-size: 1.1rem">Tipo de Servicio Solicitado</h3>
                </div>
                <div class="card-body">
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem">
                    <div class="optica-service-card active" data-service="completo" onclick="window.optica.seleccionarTipoServicio('completo')">
                      <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px">
                        <span>👓</span> Contrato Completo
                      </div>
                      <small class="text-muted">Montura de vitrina + Lunas oftálmicas graduadas + Tratamientos.</small>
                    </div>

                    <div class="optica-service-card" data-service="cambio_montura" onclick="window.optica.seleccionarTipoServicio('cambio_montura')">
                      <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px">
                        <span>🔄</span> Cambio de Montura
                      </div>
                      <small class="text-muted">Nueva montura de vitrina reutilizando las lunas del cliente.</small>
                    </div>

                    <div class="optica-service-card" data-service="reparacion" onclick="window.optica.seleccionarTipoServicio('reparacion')">
                      <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px">
                        <span>🔧</span> Reparación de Lentes
                      </div>
                      <small class="text-muted">Ajuste, soldadura, cambio de plaquetas, tornillos y mantenimiento.</small>
                    </div>

                    <div class="optica-service-card" data-service="medicion" onclick="window.optica.seleccionarTipoServicio('medicion')">
                      <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px">
                        <span>👁️</span> Medición Visual Sola
                      </div>
                      <small class="text-muted">Solo examen y emisión de receta física o ticket para el paciente.</small>
                    </div>
                  </div>
                </div>
              </div>

              <!-- PASO 3: GRADUACIÓN Y RECETA (OD / OI / ADD) -->
              <div id="seccion-receta-oftalmica" class="card" style="margin-bottom: 1.25rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex justify-between items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary)">
                  <div class="flex items-center" style="gap: 0.5rem">
                    <span style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">3</span>
                    <h3 style="margin: 0; font-size: 1.1rem">Graduación Visual (Receta Oftálmica)</h3>
                  </div>
                  <span class="badge badge-gold">Valores algebraicos (+ / -)</span>
                </div>
                <div class="card-body">
                  <div class="table-responsive" style="margin-bottom: 1rem">
                    <table class="data-table" style="font-size: 0.95rem; text-align: center; width: 100%">
                      <thead>
                        <tr style="background: var(--bg-secondary)">
                          <th style="width: 75px">OJO</th>
                          <th style="min-width: 130px">ESFERA (SPH)<br><small class="text-muted">Lejos (+ / -)</small></th>
                          <th style="min-width: 130px">CILINDRO (CYL)<br><small class="text-muted">Astigmatismo (-)</small></th>
                          <th style="min-width: 120px">EJE (°)<br><small class="text-muted">0° a 180°</small></th>
                          <th style="min-width: 130px; background: rgba(201, 169, 110, 0.2); color: var(--accent-gold-dark)">ADICIÓN (ADD)<br><small>Adicional (+)</small></th>
                          <th style="min-width: 140px; background: rgba(201, 169, 110, 0.12); color: #1e3a8a">ESF. CERCA<br><small style="color: var(--accent-gold-dark)">= Lejos + ADD</small></th>
                        </tr>
                      </thead>
                      <tbody>
                        <!-- OJO DERECHO (OD) -->
                        <tr>
                          <td style="font-weight: 800; font-size: 1.15rem; color: #1e3a8a; background: rgba(59, 130, 246, 0.08); vertical-align: middle">OD</td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-od-esfera" class="form-control text-center optica-rx-input" placeholder="+0.00" inputmode="decimal" oninput="window.optica.calcularCerca('od')">
                          </td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-od-cilindro" class="form-control text-center optica-rx-input" placeholder="-0.00" inputmode="decimal">
                          </td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-od-eje" class="form-control text-center optica-rx-input" placeholder="0° - 180°" inputmode="numeric">
                          </td>
                          <td style="padding: 0.5rem; background: rgba(201, 169, 110, 0.1)">
                            <input type="text" id="rec-od-add" class="form-control text-center optica-rx-input" placeholder="+2.00" inputmode="decimal" style="color: var(--accent-gold-dark); font-weight: 800" oninput="window.optica.calcularCerca('od')">
                          </td>
                          <td style="padding: 0.5rem; background: rgba(201, 169, 110, 0.06)">
                            <input type="text" id="rec-od-esfera-cerca" class="form-control text-center optica-rx-input" placeholder="—" readonly style="background: #fdfaf5; font-weight: 800; color: #1e3a8a; cursor: default" title="Resultado automático: Esfera Lejos + Adición">
                          </td>
                        </tr>

                        <!-- OJO IZQUIERDO (OI) -->
                        <tr>
                          <td style="font-weight: 800; font-size: 1.15rem; color: #047857; background: rgba(16, 185, 129, 0.08); vertical-align: middle">OI</td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-oi-esfera" class="form-control text-center optica-rx-input" placeholder="+0.00" inputmode="decimal" oninput="window.optica.calcularCerca('oi')">
                          </td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-oi-cilindro" class="form-control text-center optica-rx-input" placeholder="-0.00" inputmode="decimal">
                          </td>
                          <td style="padding: 0.5rem">
                            <input type="text" id="rec-oi-eje" class="form-control text-center optica-rx-input" placeholder="0° - 180°" inputmode="numeric">
                          </td>
                          <td style="padding: 0.5rem; background: rgba(201, 169, 110, 0.1)">
                            <input type="text" id="rec-oi-add" class="form-control text-center optica-rx-input" placeholder="+2.00" inputmode="decimal" style="color: var(--accent-gold-dark); font-weight: 800" oninput="window.optica.calcularCerca('oi')">
                          </td>
                          <td style="padding: 0.5rem; background: rgba(201, 169, 110, 0.06)">
                            <input type="text" id="rec-oi-esfera-cerca" class="form-control text-center optica-rx-input" placeholder="—" readonly style="background: #fdfaf5; font-weight: 800; color: #047857; cursor: default" title="Resultado automático: Esfera Lejos + Adición">
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Banner Informativo de Relación Clínica -->
                  <div style="margin-top: -0.25rem; margin-bottom: 1rem; padding: 0.55rem 0.85rem; background: rgba(201, 169, 110, 0.08); border-left: 3px solid var(--accent-gold); border-radius: 4px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; gap: 8px">
                    <div style="display: flex; align-items: center; gap: 7px">
                      <span style="font-size: 1.1rem">💡</span>
                      <span><b>Cálculo Clínico:</b> Cuando existe <b>Adición (ADD)</b>, esta se suma a la <b>Esfera de Lejos</b> y el resultado automático corresponde a la <b>Esfera de Cerca</b>.</span>
                    </div>
                    <span class="badge badge-gold" style="font-size: 0.72rem; text-transform: uppercase">Cálculo Automático</span>
                  </div>

                  <!-- Configuración de Lunas y Tratamientos (Solo Contrato Completo) -->
                  <div id="box-lunas-especificaciones">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem">
                      <div class="form-group mb-0">
                        <label class="form-label">Diseño de Luna</label>
                        <select id="rec-tipo-luna" class="form-control">
                          <option value="monofocal">Monofocal (Visión única)</option>
                          <option value="bifocal">Bifocal (Flattop / Invisible)</option>
                          <option value="progresivo">Progresivo / Multifocal</option>
                          <option value="descanso">Descanso / Neutro</option>
                          <option value="contacto">Lentes de Contacto</option>
                          <option value="otro">Otro diseño</option>
                        </select>
                      </div>

                      <div class="form-group mb-0">
                        <label class="form-label">Material de Luna</label>
                        <select id="rec-material-luna" class="form-control">
                          <option value="resina_cr39">Resina Orgánica CR-39</option>
                          <option value="policarbonato">Policarbonato (Alto impacto)</option>
                          <option value="alto_indice">Alto Índice 1.61 / 1.67</option>
                          <option value="vidrio">Cristal / Vidrio mineral</option>
                          <option value="otro">Otro material</option>
                        </select>
                      </div>

                      <div class="form-group mb-0">
                        <label class="form-label">Color / Tinte</label>
                        <input type="text" id="rec-color-tinte" class="form-control" placeholder="Blanco, Gris, Café, G-15, etc.">
                      </div>
                    </div>

                    <!-- Tratamientos y Filtros -->
                    <div style="margin-top: 1rem">
                      <label class="form-label">Filtros y Tratamientos Especiales</label>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--border-radius-md); border: 1px solid var(--bg-secondary)">
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="antirreflejo"> Antirreflejo (AR)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="fotocromatico"> Fotocromático (Transition)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="filtro_azul"> Filtro Luz Azul (Blue Defense)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="uv400"> Filtro UV 400
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="polarizado"> Polarizado
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem">
                          <input type="checkbox" class="chk-tratamiento" value="antirrayas"> Anti-rayas endurecido
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem">
                    <div class="form-group mb-0">
                      <label class="form-label">Indicaciones Oftálmicas</label>
                      <input type="text" id="rec-indicaciones" class="form-control" placeholder="Uso permanente, descanso, lectura...">
                    </div>
                    <div class="form-group mb-0">
                      <label class="form-label">Observaciones de la Graduación</label>
                      <input type="text" id="rec-observaciones" class="form-control" placeholder="Notas clínicas adicionales...">
                    </div>
                  </div>
                </div>
              </div>

              <!-- PASO 4: MONTURA / VITRINA / REPARACIÓN -->
              <div id="seccion-montura-taller" class="card optica-card-overflow" style="margin-bottom: 1.25rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex justify-between items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary)">
                  <div class="flex items-center" style="gap: 0.5rem">
                    <span style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">4</span>
                    <h3 id="titulo-seccion-montura" style="margin: 0; font-size: 1.1rem">Selección de Montura de Vitrina</h3>
                  </div>
                  <div id="badge-montura-sucursal" class="badge badge-gold">Vitrina Sucursal Actual</div>
                </div>
                <div class="card-body">
                  <!-- Caso Montura de Vitrina (Completo y Cambio Montura) -->
                  <div id="box-seleccion-montura">
                    <!-- Buscador de Monturas (Visible cuando NO hay montura elegida) -->
                    <div id="box-buscador-monturas">
                      <label class="form-label" style="font-weight: 600; margin-bottom: 6px">Buscar y Seleccionar Montura desde Vitrina</label>
                      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem">
                        <div style="flex: 1; position: relative">
                          <input type="text" id="input-buscar-montura" class="form-control" placeholder="Escribe para buscar por código, nombre o vitrina (ej. Vitrina 1)..." autocomplete="off" style="height: 44px; font-size: 0.95rem">
                        </div>
                        <button type="button" class="btn btn-secondary" onclick="window.optica.abrirScannerMontura()" title="Escanear código de barras con cámara" style="height: 44px; display: flex; align-items: center; gap: 6px">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          Escanear
                        </button>
                      </div>
                      
                      <!-- Lista de Resultados de Montura (Contenedor destacado, visible y sin cortes) -->
                      <div id="lista-resultados-monturas" class="hidden" style="margin-top: 0.5rem; margin-bottom: 1rem; background: white; border: 2px solid var(--accent-gold); border-radius: var(--border-radius-md); box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 290px; overflow-y: auto"></div>
                    </div>

                    <!-- Ficha Montura Seleccionada (Destacada, visible y amplia) -->
                    <div id="box-montura-seleccionada" class="hidden" style="background: linear-gradient(135deg, rgba(201, 169, 110, 0.08) 0%, rgba(201, 169, 110, 0.20) 100%); border: 2px solid var(--accent-gold); border-radius: var(--border-radius-md); padding: 1.25rem; margin-bottom: 0.5rem">
                      <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: 1rem">
                        <div style="display: flex; align-items: center; gap: 0.85rem">
                          <div style="background: var(--accent-gold); color: white; width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; box-shadow: var(--shadow-sm); flex-shrink: 0">👓</div>
                          <div>
                            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-gold-dark); font-weight: 800">Montura Seleccionada para el Trabajo</div>
                            <div id="montura-sel-nombre" style="font-weight: 800; font-size: 1.15rem; color: var(--text-primary); margin-top: 2px">-</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); display: flex; gap: 1rem; margin-top: 4px; flex-wrap: wrap">
                              <span><strong>Código / SKU:</strong> <span id="montura-sel-codigo" style="font-family: monospace; font-weight: 700">-</span></span>
                              <span><strong>Ubicación:</strong> <span id="montura-sel-vitrina" class="badge badge-secondary">-</span></span>
                              <span><strong>Stock en tienda:</strong> <span id="montura-sel-stock" class="badge badge-success">-</span></span>
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center" style="gap: 1rem">
                          <div style="background: white; padding: 0.5rem 0.85rem; border-radius: var(--border-radius-sm); border: 1.5px solid var(--accent-gold-light); text-align: right">
                            <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px; font-weight: 600">Precio de Montura</label>
                            <div style="display: flex; align-items: center; gap: 4px">
                              <span class="fw-bold text-gold" style="font-size: 1.15rem">S/</span>
                              <input type="number" id="montura-sel-precio-input" class="form-control" style="width: 105px; text-align: right; font-weight: 800; font-size: 1.15rem; height: 38px" min="0" step="0.5" oninput="window.optica.actualizarPrecios()">
                            </div>
                          </div>
                          <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.optica.deseleccionarMontura()" title="Cambiar montura" style="height: 40px; padding: 0 1rem; display: flex; align-items: center; gap: 4px; font-weight: 600">
                            ✕ Cambiar Montura
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Campos específicos de Cambio de Montura (Reutiliza lunas) -->
                  <div id="box-cambio-montura-detalles" class="hidden" style="margin-top: 1rem; background: rgba(201, 169, 110, 0.1); padding: 1rem; border-radius: var(--border-radius-md); border: 1px dashed var(--accent-gold)">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; color: var(--accent-gold-dark)">Datos de Reutilización de Lunas del Cliente</h4>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem">
                      <div class="form-group mb-0">
                        <label class="form-label">Estado de las Lunas del Cliente y Compatibilidad</label>
                        <input type="text" id="cambio-obs-lunas" class="form-control" placeholder="Ej. Lunas en buen estado, leves microrrayaduras, bisel compatible con nueva montura...">
                      </div>
                      <div class="form-group mb-0">
                        <label class="form-label">Costo Adaptación / Montaje (S/.)</label>
                        <input type="number" id="cambio-costo-montaje" class="form-control" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                      </div>
                    </div>
                  </div>

                  <!-- Campos específicos de Reparación -->
                  <div id="box-reparacion-detalles" class="hidden" style="margin-top: 0.5rem">
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem">
                      <div class="form-group mb-0">
                        <label class="form-label">Descripción del Problema y Reparación Solicitada</label>
                        <textarea id="rep-descripcion" class="form-control" rows="3" placeholder="Ej. Brazo izquierdo roto, soldadura de bisagra, cambio de plaquetas de silicona y ajuste general..."></textarea>
                      </div>
                      <div>
                        <div class="form-group">
                          <label class="form-label">Costo Reparación / Mano de Obra (S/.)</label>
                          <input type="number" id="rep-costo" class="form-control" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                        </div>
                        <div class="form-group mb-0">
                          <label class="form-label">Responsable / Técnico Taller</label>
                          <input type="text" id="rep-tecnico" class="form-control" placeholder="Técnico a cargo">
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- PASO 5: PRODUCTOS Y ACCESORIOS ADICIONALES (NUEVA SECCIÓN) -->
              <div id="seccion-productos-adicionales" class="card optica-card-overflow" style="margin-bottom: 1.25rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex justify-between items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary)">
                  <div class="flex items-center" style="gap: 0.5rem">
                    <span style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">5</span>
                    <h3 style="margin: 0; font-size: 1.1rem">Productos y Accesorios Adicionales</h3>
                  </div>
                  <span class="badge badge-secondary">Opcional</span>
                </div>
                <div class="card-body">
                  <p class="text-muted" style="margin-top: 0; font-size: 0.88rem; margin-bottom: 0.75rem">
                    Agrega al contrato productos complementarios (estuches, paños de microfibra, líquidos de limpieza, cordones, etc.).
                  </p>

                  <!-- Buscador de Adicionales -->
                  <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem">
                    <div style="flex: 1; position: relative">
                      <input type="text" id="input-buscar-adicional" class="form-control" placeholder="Buscar por código (ej. JM-VAR-..., JM-PRD-...) o nombre..." autocomplete="off" style="height: 44px; font-size: 0.95rem">
                    </div>
                    <button type="button" class="btn btn-secondary" onclick="window.optica.abrirScannerAdicional()" title="Escanear código de barras de accesorio" style="height: 44px; display: flex; align-items: center; gap: 6px">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                      Escanear
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="window.optica.abrirModalItemManual()" title="Agregar un producto o servicio manual" style="height: 44px">
                      + Manual
                    </button>
                  </div>

                  <!-- Resultados del buscador de adicionales -->
                  <div id="lista-resultados-adicionales" class="hidden" style="margin-top: 0.5rem; margin-bottom: 1rem; background: white; border: 2px solid var(--accent-gold); border-radius: var(--border-radius-md); box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 260px; overflow-y: auto"></div>

                  <!-- Tabla de Productos Adicionales Agregados -->
                  <div id="box-tabla-adicionales" style="margin-top: 0.75rem">
                    <div id="vacio-adicionales" class="text-center text-muted" style="padding: 1.25rem; border: 1.5px dashed var(--bg-tertiary); border-radius: var(--border-radius-md); font-size: 0.9rem">
                      📦 No se han agregado productos adicionales a este contrato (opcional).
                    </div>
                    <div id="tabla-adicionales-wrapper" class="hidden">
                      <div class="table-responsive">
                        <table class="data-table" style="font-size: 0.9rem; width: 100%">
                          <thead>
                            <tr style="background: var(--bg-secondary)">
                              <th>Producto / Accesorio</th>
                              <th style="width: 130px; text-align: center">Cantidad</th>
                              <th style="width: 140px; text-align: right">P. Unitario (S/)</th>
                              <th style="width: 130px; text-align: right">Subtotal</th>
                              <th style="width: 70px; text-align: center">Quitar</th>
                            </tr>
                          </thead>
                          <tbody id="tbody-adicionales"></tbody>
                        </table>
                      </div>
                      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; margin-top: 0.75rem; padding: 0.75rem 1rem; background: var(--bg-primary); border-radius: var(--border-radius-sm); border: 1px solid var(--bg-secondary)">
                        <span style="font-size: 0.95rem; font-weight: 700">Total Productos Adicionales:</span>
                        <span id="lbl-total-adicionales-box" class="fw-bold text-gold" style="font-size: 1.15rem">S/ 0.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- PASO 6: RESUMEN ECONÓMICO Y COBRO DE ADELANTO -->
              <div class="card" style="margin-bottom: 1.5rem; border: 1px solid var(--accent-gold-light)">
                <div class="card-header flex justify-between items-center" style="background: var(--bg-primary); border-bottom: 1px solid var(--bg-secondary)">
                  <div class="flex items-center" style="gap: 0.5rem">
                    <span id="badge-paso-resumen" style="background: var(--accent-gold); color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem">6</span>
                    <h3 style="margin: 0; font-size: 1.1rem">Fechas, Resumen Económico y Pago</h3>
                  </div>
                  <div class="text-gold fw-bold" id="resumen-total-preview" style="font-size: 1.25rem">Total: S/ 0.00</div>
                </div>
                <div class="card-body">
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem">
                    <!-- Columna Izquierda: Costos y Fechas -->
                    <div>
                      <div class="form-group">
                        <label class="form-label">Fecha Estimada de Entrega al Cliente</label>
                        <input type="datetime-local" id="w-fecha-entrega" class="form-control">
                      </div>

                      <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--border-radius-md); border: 1px solid var(--bg-secondary)">
                        <div style="font-weight: 700; margin-bottom: 0.75rem; color: var(--accent-gold-dark)">Desglose del Contrato</div>
                        
                        <div id="row-costo-montura" class="flex justify-between items-center" style="margin-bottom: 0.5rem">
                          <span class="text-muted">Montura:</span>
                          <span class="fw-bold" id="lbl-costo-montura">S/ 0.00</span>
                        </div>

                        <div id="row-costo-lunas" class="flex justify-between items-center" style="margin-bottom: 0.5rem">
                          <span class="text-muted">Lunas y Tratamientos:</span>
                          <div style="display: flex; align-items: center; gap: 4px">
                            <span class="fw-bold">S/</span>
                            <input type="number" id="w-costo-lunas" class="form-control" style="width: 85px; text-align: right; padding: 2px 6px; height: 30px" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                          </div>
                        </div>

                        <div id="row-costo-servicio" class="flex justify-between items-center hidden" style="margin-bottom: 0.5rem">
                          <span class="text-muted" id="lbl-nombre-servicio">Servicio / Reparación / Adaptación:</span>
                          <span class="fw-bold" id="lbl-costo-servicio">S/ 0.00</span>
                        </div>

                        <!-- EXAMEN / MEDICIÓN VISUAL SOLA -->
                        <div id="row-costo-medicion" class="flex justify-between items-center hidden" style="margin-bottom: 0.5rem">
                          <span class="text-muted">Examen / Medición Visual:</span>
                          <div style="display: flex; align-items: center; gap: 4px">
                            <span class="fw-bold">S/</span>
                            <input type="number" id="w-costo-medicion" class="form-control" style="width: 85px; text-align: right; padding: 2px 6px; height: 30px" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                          </div>
                        </div>

                        <!-- PRODUCTOS ADICIONALES -->
                        <div id="row-costo-adicionales" class="flex justify-between items-center" style="margin-bottom: 0.5rem">
                          <span class="text-muted">Productos Adicionales:</span>
                          <span class="fw-bold text-gold" id="lbl-costo-adicionales">S/ 0.00</span>
                        </div>

                        <div id="row-costo-descuento" class="flex justify-between items-center" style="margin-bottom: 0.5rem">
                          <span class="text-muted">Descuento Especial:</span>
                          <div style="display: flex; align-items: center; gap: 4px">
                            <span class="fw-bold text-danger">- S/</span>
                            <input type="number" id="w-descuento" class="form-control" style="width: 85px; text-align: right; padding: 2px 6px; height: 30px" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                          </div>
                        </div>

                        <div class="flex justify-between items-center" style="border-top: 2px solid var(--bg-tertiary); padding-top: 0.5rem; font-size: 1.15rem; font-weight: 800; color: var(--text-primary)">
                          <span>TOTAL A PAGAR:</span>
                          <span class="text-gold" id="lbl-costo-total">S/ 0.00</span>
                        </div>
                      </div>
                    </div>

                    <!-- Columna Derecha: Adelanto y Cobro -->
                    <div>
                      <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: var(--border-radius-md); border-left: 4px solid var(--color-success)">
                        <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.75rem; color: var(--text-primary)">
                          💵 Registro de Adelanto / Pago Inicial
                        </div>

                        <div class="form-group">
                          <div class="flex justify-between items-center" style="margin-bottom: 4px">
                            <label class="form-label mb-0">Monto del Adelanto (S/.)</label>
                            <div style="display: flex; gap: 4px">
                              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem" onclick="window.optica.setAdelanto(0)">S/ 0</button>
                              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem" onclick="window.optica.setAdelanto(0.5)">50%</button>
                              <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem" onclick="window.optica.setAdelanto(1)">100%</button>
                            </div>
                          </div>
                          <input type="number" id="w-adelanto" class="form-control" style="font-size: 1.2rem; font-weight: 800; text-align: right" value="0.00" min="0" step="1" oninput="window.optica.actualizarPrecios()">
                        </div>

                        <div class="flex justify-between items-center" style="margin-bottom: 1rem; font-size: 1rem; font-weight: 700">
                          <span class="text-muted">Saldo Pendiente:</span>
                          <span id="lbl-saldo-pendiente" style="color: var(--color-danger)">S/ 0.00</span>
                        </div>

                        <div class="form-group">
                          <label class="form-label">Método de Pago del Adelanto</label>
                          <select id="w-metodo-pago" class="form-control" onchange="window.optica.cambiarMetodoPago()">
                            <option value="efectivo">Efectivo</option>
                            <option value="yape">Yape / Plin</option>
                            <option value="tarjeta">Tarjeta (POS)</option>
                            <option value="transferencia">Transferencia Bancaria</option>
                            <option value="mixto">Mixto (Efectivo + Yape)</option>
                          </select>
                        </div>

                        <div id="box-pago-mixto" class="hidden" style="margin-bottom: 0.75rem; background: var(--bg-primary); padding: 0.5rem; border-radius: var(--border-radius-sm)">
                          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem">
                            <div>
                              <label style="font-size: 0.75rem">Monto Efectivo</label>
                              <input type="number" id="w-monto-efectivo" class="form-control" value="0" min="0" step="1">
                            </div>
                            <div>
                              <label style="font-size: 0.75rem">Monto Yape</label>
                              <input type="number" id="w-monto-yape" class="form-control" value="0" min="0" step="1">
                            </div>
                          </div>
                        </div>

                        <div class="form-group mb-0">
                          <label class="form-label">Observaciones Generales</label>
                          <input type="text" id="w-observaciones" class="form-control" placeholder="Indicaciones para el cliente o taller...">
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Botón Guardar Contrato -->
                  <div style="margin-top: 1.5rem; text-align: right; display: flex; justify-content: flex-end; gap: 0.75rem">
                    <button type="button" class="btn btn-secondary" onclick="window.optica.resetNuevoContrato()">
                      Limpiar Formulario
                    </button>
                    <button type="button" class="btn btn-primary" id="btn-guardar-contrato" onclick="window.optica.guardarContrato()" style="padding: 0.75rem 2rem; font-size: 1.05rem">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;margin-right:6px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                      Generar Contrato / Orden de Trabajo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PESTAÑA 3: HISTORIAL DE RECETAS -->
          <div id="optica-view-recetas" class="optica-view hidden">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem">
              <div style="flex: 1; max-width: 450px">
                <input type="text" id="filtro-recetas-search" class="form-control" placeholder="Buscar por paciente, documento o especialista...">
              </div>
              <button class="btn btn-primary" onclick="window.optica.iniciarMedicionSola()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                + Registrar Medición Independiente
              </button>
            </div>

            <div class="table-responsive">
              <table class="data-table" id="tabla-recetas-optica">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th>Edad</th>
                    <th>Graduación OD (Lejos / Cerca)</th>
                    <th>Graduación OI (Lejos / Cerca)</th>
                    <th>Tipo Luna / Tratamientos</th>
                    <th>Atendido por</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tbody-recetas-optica">
                  <tr><td colspan="8" class="text-center text-muted" style="padding: 2rem">Cargando recetas...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PESTAÑA 4: TRASLADOS DE MONTURAS -->
          <div id="optica-view-traslados" class="optica-view hidden">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem">
              <div>
                <h3 style="margin: 0; font-size: 1.15rem">Traslados de Monturas entre Sucursales</h3>
                <small class="text-muted">Movimiento controlado de armazones entre vitrinas de Tienda 1 y Tienda 2</small>
              </div>
              <button class="btn btn-primary" onclick="window.optica.abrirModalSolicitarTraslado()">
                + Solicitar Traslado de Montura
              </button>
            </div>

            <div class="table-responsive">
              <table class="data-table" id="tabla-traslados-optica">
                <thead>
                  <tr>
                    <th>Fecha Solicitud</th>
                    <th>Montura / Producto</th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Solicitado por</th>
                    <th>Estado</th>
                    <th class="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tbody-traslados-optica">
                  <tr><td colspan="7" class="text-center text-muted" style="padding: 2rem">Cargando traslados...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- MODALES DEL SISTEMA DE ÓPTICA -->

      <!-- Modal Detalle Completo de Contrato -->
      <div id="modal-optica-detalle" class="modal-overlay">
        <div class="modal" style="max-width: 800px; width: 95%">
          <div class="modal-header flex justify-between items-center">
            <h3 class="text-gold" id="modal-optica-detalle-titulo">Detalle de Contrato</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-optica-detalle')">✕</button>
          </div>
          <div class="modal-body" id="modal-optica-detalle-body" style="max-height: 80vh; overflow-y: auto">
            Cargando...
          </div>
          <div class="modal-footer flex justify-between items-center" id="modal-optica-detalle-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-optica-detalle')">Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Modal Registrar Abono / Pago -->
      <div id="modal-optica-abono" class="modal-overlay">
        <div class="modal" style="max-width: 480px">
          <div class="modal-header flex justify-between items-center">
            <h3 class="text-gold">Registrar Abono / Pago</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-optica-abono')">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="abono-contrato-id">
            <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: var(--border-radius-md); margin-bottom: 1rem">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                <span class="text-muted">Contrato:</span>
                <strong id="abono-codigo-lbl">-</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                <span class="text-muted">Cliente:</span>
                <span id="abono-cliente-lbl">-</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                <span class="text-muted">Total Contrato:</span>
                <span id="abono-total-lbl">S/ 0.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--color-danger)">
                <span>Saldo Pendiente:</span>
                <span id="abono-saldo-lbl">S/ 0.00</span>
              </div>
            </div>

            <div class="form-group">
              <div class="flex justify-between items-center" style="margin-bottom: 4px">
                <label class="form-label mb-0">Monto a Abonar (S/.)</label>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.optica.liquidarSaldoCompleto()" style="font-size: 0.75rem; padding: 2px 6px">
                  Liquidar Todo
                </button>
              </div>
              <input type="number" id="abono-monto-input" class="form-control" style="font-size: 1.25rem; font-weight: bold; text-align: right" min="0.5" step="0.5">
            </div>

            <div class="form-group">
              <label class="form-label">Método de Pago</label>
              <select id="abono-metodo-select" class="form-control" onchange="window.optica.cambiarMetodoAbono()">
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape / Plin</option>
                <option value="tarjeta">Tarjeta (POS)</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto (Efectivo + Yape)</option>
              </select>
            </div>

            <div id="box-abono-mixto" class="hidden" style="margin-bottom: 1rem; background: var(--bg-primary); padding: 0.5rem; border-radius: var(--border-radius-sm)">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem">
                <div>
                  <label style="font-size: 0.75rem">Monto Efectivo</label>
                  <input type="number" id="abono-monto-efectivo" class="form-control" value="0" min="0" step="1">
                </div>
                <div>
                  <label style="font-size: 0.75rem">Monto Yape</label>
                  <input type="number" id="abono-monto-yape" class="form-control" value="0" min="0" step="1">
                </div>
              </div>
            </div>

            <div class="form-group mb-0">
              <label class="form-label">Notas del Abono</label>
              <input type="text" id="abono-notas-input" class="form-control" placeholder="N° de operación o detalle...">
            </div>
          </div>
          <div class="modal-footer flex justify-between">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-optica-abono')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.optica.confirmarAbono()">Registrar Abono</button>
          </div>
        </div>
      </div>

      <!-- Modal Cambiar Estado de Contrato -->
      <div id="modal-optica-estado" class="modal-overlay">
        <div class="modal" style="max-width: 480px">
          <div class="modal-header flex justify-between items-center">
            <h3 class="text-gold">Cambiar Estado de Trabajo</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-optica-estado')">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="estado-contrato-id">
            <div class="form-group">
              <label class="form-label">Nuevo Estado del Trabajo</label>
              <select id="estado-nuevo-select" class="form-control">
                <option value="registrado">Registrado (Recibido)</option>
                <option value="pendiente_elaboracion">Pendiente Laboratorio</option>
                <option value="en_elaboracion">En Elaboración / Taller</option>
                <option value="listo_entrega">Listo para Entrega al Cliente</option>
                <option value="entregado">Entregado al Cliente (Finalizado)</option>
                <option value="cancelado">Cancelado (Anular y Revertir Stock)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Técnico / Responsable Taller</label>
              <input type="text" id="estado-tecnico-input" class="form-control" placeholder="Nombre del técnico o responsable">
            </div>

            <div class="form-group mb-0">
              <label class="form-label">Observaciones / Notas del Taller</label>
              <textarea id="estado-notas-input" class="form-control" rows="3" placeholder="Detalles de la elaboración, control de calidad, entrega..."></textarea>
            </div>
          </div>
          <div class="modal-footer flex justify-between">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-optica-estado')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.optica.confirmarCambioEstado()">Actualizar Estado</button>
          </div>
        </div>
      </div>

      <!-- Modal Nuevo Cliente Rápido con cálculo automático de edad -->
      <div id="modal-optica-nuevo-cliente" class="modal-overlay">
        <div class="modal" style="max-width: 520px">
          <div class="modal-header flex justify-between items-center">
            <h3 class="text-gold">Registrar Nuevo Cliente / Paciente</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-optica-nuevo-cliente')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nombres y Apellidos *</label>
              <input type="text" id="m-clie-nombre" class="form-control" required placeholder="Nombre completo">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.75rem">
              <div class="form-group">
                <label class="form-label">Tipo Doc.</label>
                <select id="m-clie-tipodoc" class="form-control">
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">C.E.</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">N° Documento</label>
                <input type="text" id="m-clie-documento" class="form-control" placeholder="Número de documento">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem">
              <div class="form-group">
                <label class="form-label">Fecha de Nacimiento</label>
                <input type="date" id="m-clie-nacimiento" class="form-control" onchange="window.optica.calcularEdadDesdeNacimiento()">
              </div>
              <div class="form-group">
                <label class="form-label">Edad (Años)</label>
                <input type="number" id="m-clie-edad" class="form-control" min="0" max="120" placeholder="Años">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem">
              <div class="form-group">
                <label class="form-label">Teléfono / WhatsApp</label>
                <input type="text" id="m-clie-telefono" class="form-control" placeholder="999999999">
              </div>
              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" id="m-clie-direccion" class="form-control" placeholder="Dirección">
              </div>
            </div>
          </div>
          <div class="modal-footer flex justify-between">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-optica-nuevo-cliente')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.optica.guardarNuevoCliente()">Guardar y Seleccionar</button>
          </div>
        </div>
      </div>

      <!-- Modal Éxito Contrato Creado -->
      <div id="modal-optica-exito" class="modal-overlay">
        <div class="modal" style="max-width: 480px; text-align: center">
          <div class="modal-body" style="padding: 2rem 1.5rem">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:36px;height:36px"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h3 style="margin-bottom: 0.25rem" class="text-gold">¡Contrato Generado con Éxito!</h3>
            <div id="exito-codigo-contrato" style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem">OPT-260000</div>
            <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 1.5rem" id="exito-mensaje-contrato">La orden de trabajo fue registrada y el stock ha sido reservado correctamente.</p>

            <div style="display: flex; flex-direction: column; gap: 0.75rem">
              <button class="btn btn-primary w-full" id="btn-exito-ticket">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:6px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir Ticket Térmico (58mm/80mm)
              </button>
              <button class="btn btn-secondary w-full" id="btn-exito-pdf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:6px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Descargar / Ver PDF Orden de Trabajo (A4)
              </button>
              <button class="btn btn-secondary w-full" onclick="app.closeModal('modal-optica-exito'); window.opticaSwitchTab('contratos');">
                Ir al Listado de Contratos
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inyectar estilos específicos de óptica
    if (!document.getElementById('optica-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'optica-styles';
      styleEl.textContent = `
        .optica-nav-tab {
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          padding: 0.85rem 1.25rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .optica-nav-tab:hover {
          color: var(--accent-gold-dark);
          background: rgba(201, 169, 110, 0.08);
        }
        .optica-nav-tab.active {
          color: var(--accent-gold-dark);
          border-bottom-color: var(--accent-gold);
          font-weight: 700;
        }
        .optica-service-card {
          border: 2px solid var(--bg-tertiary);
          border-radius: var(--border-radius-md);
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-card);
        }
        .optica-service-card:hover {
          border-color: var(--accent-gold);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
        .optica-service-card.active {
          border-color: var(--accent-gold);
          background: rgba(201, 169, 110, 0.12);
        }
        .optica-item-hover:hover {
          background: rgba(201, 169, 110, 0.1);
          cursor: pointer;
        }
      `;
      document.head.appendChild(styleEl);
    }
  },

  bindEvents() {
    // Búsqueda en tabla de contratos
    const searchContratos = document.getElementById('filtro-optica-search');
    if (searchContratos) {
      searchContratos.addEventListener('input', () => this.debounceLoadContratos());
    }
    const estadoSelect = document.getElementById('filtro-optica-estado');
    if (estadoSelect) {
      estadoSelect.addEventListener('change', () => this.loadContratos());
    }
    const pagoSelect = document.getElementById('filtro-optica-estado-pago');
    if (pagoSelect) {
      pagoSelect.addEventListener('change', () => this.loadContratos());
    }
    const tipoSelect = document.getElementById('filtro-optica-tipo-servicio');
    if (tipoSelect) {
      tipoSelect.addEventListener('change', () => this.loadContratos());
    }
    const chkPendientes = document.getElementById('filtro-optica-pendientes');
    if (chkPendientes) {
      chkPendientes.addEventListener('change', () => this.loadContratos());
    }

    // Autocomplete Cliente en Wizard
    const clieInput = document.getElementById('wizard-cliente-input');
    if (clieInput) {
      clieInput.addEventListener('input', (e) => this.buscarClientes(e.target.value));
      // Cerrar dropdown al hacer click afuera
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#box-cliente-busqueda')) {
          const resEl = document.getElementById('wizard-cliente-resultados');
          if (resEl) resEl.classList.add('hidden');
        }
      });
    }

    // Buscador de Monturas
    const monturaInput = document.getElementById('input-buscar-montura');
    if (monturaInput) {
      monturaInput.addEventListener('input', (e) => this.buscarMonturas(e.target.value));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#box-seleccion-montura')) {
          const resEl = document.getElementById('lista-resultados-monturas');
          if (resEl) resEl.classList.add('hidden');
        }
      });
    }

    // Buscador de Productos Adicionales
    const adicInput = document.getElementById('input-buscar-adicional');
    if (adicInput) {
      adicInput.addEventListener('input', (e) => this.buscarAdicionales(e.target.value));
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#seccion-productos-adicionales')) {
          const resEl = document.getElementById('lista-resultados-adicionales');
          if (resEl) resEl.classList.add('hidden');
        }
      });
    }

    // Tratamientos checkboxes
    document.querySelectorAll('.chk-tratamiento').forEach(chk => {
      chk.addEventListener('change', () => this.recolectarTratamientos());
    });

    // Búsqueda en recetas
    const searchRecetas = document.getElementById('filtro-recetas-search');
    if (searchRecetas) {
      searchRecetas.addEventListener('input', () => this.filtrarRecetasLocales());
    }
  },

  async loadSucursales() {
    try {
      const res = await api.get('/sucursales');
      this.sucursales = res.data || [];
    } catch (e) {
      console.warn('Error cargando sucursales:', e);
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.optica-nav-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.optica-view').forEach(v => v.classList.add('hidden'));

    const tabBtn = document.getElementById(`optica-tab-btn-${tab}`);
    if (tabBtn) tabBtn.classList.add('active');

    const view = document.getElementById(`optica-view-${tab}`);
    if (view) view.classList.remove('hidden');

    if (tab === 'contratos') this.loadContratos();
    else if (tab === 'recetas') this.loadRecetas();
    else if (tab === 'traslados') this.loadTraslados();
    else if (tab === 'nueva-atencion') {
      this.cargarCatalogoMonturas();
      this.cargarCatalogoGeneral();
    }
  },

  // ==========================================================================
  // TAB 1: CONTRATOS Y ÓRDENES
  // ==========================================================================
  debounceTimeout: null,
  debounceLoadContratos() {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => this.loadContratos(), 350);
  },

  async loadContratos() {
    try {
      const params = {};
      const search = document.getElementById('filtro-optica-search')?.value;
      const estado = document.getElementById('filtro-optica-estado')?.value;
      const estadoPago = document.getElementById('filtro-optica-estado-pago')?.value;
      const tipoServicio = document.getElementById('filtro-optica-tipo-servicio')?.value;
      const pendientes = document.getElementById('filtro-optica-pendientes')?.checked;

      if (search) params.search = search;
      if (estado) params.estado = estado;
      if (estadoPago) params.estado_pago = estadoPago;
      if (tipoServicio) params.tipo_servicio = tipoServicio;
      if (pendientes) params.pendientes_entrega = 'true';

      const res = await api.get('/optica/contratos', params);
      if (res.success) {
        this.contratos = res.data || [];
        this.renderContratos();
        this.actualizarMetricas();
      }
    } catch (err) {
      app.showToast('Error cargando contratos: ' + err.message, 'error');
    }
  },

  actualizarMetricas() {
    const total = this.contratos.length;
    const enTaller = this.contratos.filter(c => c.estado === 'en_elaboracion' || c.estado === 'pendiente_elaboracion').length;
    const listos = this.contratos.filter(c => c.estado === 'listo_entrega').length;
    const conSaldo = this.contratos.filter(c => parseFloat(c.saldo_pendiente) > 0).length;

    const elTotal = document.getElementById('stat-total-contratos');
    if (elTotal) elTotal.textContent = total;
    const elTaller = document.getElementById('stat-en-taller');
    if (elTaller) elTaller.textContent = enTaller;
    const elListos = document.getElementById('stat-listos');
    if (elListos) elListos.textContent = listos;
    const elSaldo = document.getElementById('stat-con-saldo');
    if (elSaldo) elSaldo.textContent = conSaldo;

    const badge = document.getElementById('badge-contador-contratos');
    if (badge) badge.textContent = listos + enTaller;
  },

  renderContratos() {
    const tbody = document.getElementById('tbody-contratos-optica');
    if (!tbody) return;

    if (this.contratos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem">No se encontraron contratos con los filtros aplicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.contratos.map(c => {
      const tipoBadge = this.getTipoServicioBadge(c.tipo_servicio);
      const estadoBadge = this.getEstadoTrabajoBadge(c.estado);
      const pagoBadge = this.getEstadoPagoBadge(c.estado_pago, c.saldo_pendiente);
      const fechaContrato = this.fmtFecha(c.fecha_contrato);
      const fechaEstimada = c.fecha_estimada_entrega ? this.fmtFecha(c.fecha_estimada_entrega) : '—';
      const saldo = parseFloat(c.saldo_pendiente || 0);

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-primary); font-family: monospace; font-size: 0.95rem">${c.codigo_contrato}</div>
            <div style="margin-top: 2px">${tipoBadge}</div>
            <small class="text-muted" style="font-size: 0.75rem">${c.sucursal_nombre || ''}</small>
          </td>
          <td>
            <div style="font-weight: 600">${c.cliente_nombre || 'Cliente General'}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary)">
              ${c.cliente_dni_ruc ? `Doc: ${c.cliente_dni_ruc}` : ''}
              ${c.cliente_telefono ? ` · Tel: ${c.cliente_telefono}` : ''}
            </div>
          </td>
          <td>
            <div style="font-size: 0.85rem; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis" title="${c.montura_descripcion || 'Sin montura'}">
              ${c.montura_descripcion || '<span class="text-muted">—</span>'}
            </div>
            ${c.responsable_taller ? `<small class="text-muted">Taller: ${c.responsable_taller}</small>` : ''}
          </td>
          <td style="font-size: 0.82rem">
            <div><strong>Reg:</strong> ${fechaContrato}</div>
            <div style="color: ${c.estado === 'entregado' ? 'var(--text-muted)' : '#b45309'}"><strong>Prom:</strong> ${fechaEstimada}</div>
          </td>
          <td>
            <div class="fw-bold" style="font-size: 0.95rem">S/ ${parseFloat(c.total).toFixed(2)}</div>
            <div style="font-size: 0.8rem; color: ${saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">
              ${saldo > 0 ? `Saldo: S/ ${saldo.toFixed(2)}` : 'Cancelado'}
            </div>
          </td>
          <td>${estadoBadge}</td>
          <td>${pagoBadge}</td>
          <td class="text-right">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end">
              <button class="btn btn-secondary btn-sm" title="Ver Detalle Completo" onclick="window.opticaVerContrato(${c.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </button>
              ${saldo > 0 && c.estado !== 'cancelado' ? `
                <button class="btn btn-success btn-sm" title="Registrar Abono" onclick="window.opticaAbonar(${c.id})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </button>
              ` : ''}
              ${c.estado !== 'cancelado' && c.estado !== 'entregado' ? `
                <button class="btn btn-secondary btn-sm" title="Cambiar Estado Taller" onclick="window.opticaCambiarEstado(${c.id})">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" title="Imprimir Ticket Térmico" onclick="window.opticaPrintTicket(${c.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              </button>
              <button class="btn btn-secondary btn-sm" title="Descargar PDF A4" onclick="window.opticaPdfContrato(${c.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==========================================================================
  // TAB 2: WIZARD DE NUEVA ATENCIÓN
  // ==========================================================================
  seleccionarTipoServicio(tipo) {
    this.nuevoContrato.tipo_servicio = tipo;
    document.querySelectorAll('.optica-service-card').forEach(c => {
      c.classList.toggle('active', c.dataset.service === tipo);
    });

    const secReceta = document.getElementById('seccion-receta-oftalmica');
    const boxLunasSpecs = document.getElementById('box-lunas-especificaciones');
    const secMontura = document.getElementById('seccion-montura-taller');
    const secAdicionales = document.getElementById('seccion-productos-adicionales');
    const boxMontura = document.getElementById('box-seleccion-montura');
    const boxCambio = document.getElementById('box-cambio-montura-detalles');
    const boxRep = document.getElementById('box-reparacion-detalles');
    const tituloMontura = document.getElementById('titulo-seccion-montura');

    // Desglose del Contrato en Paso Resumen
    const rowMontura = document.getElementById('row-costo-montura');
    const rowLunas = document.getElementById('row-costo-lunas');
    const rowServicio = document.getElementById('row-costo-servicio');
    const rowMedicion = document.getElementById('row-costo-medicion');
    const rowAdicionales = document.getElementById('row-costo-adicionales');
    const lblNombreServicio = document.getElementById('lbl-nombre-servicio');
    const badgePasoResumen = document.getElementById('badge-paso-resumen');

    // Adaptar secciones visibles según tipo
    if (tipo === 'completo') {
      secReceta?.classList.remove('hidden');
      boxLunasSpecs?.classList.remove('hidden');
      secMontura?.classList.remove('hidden');
      secAdicionales?.classList.remove('hidden');
      boxMontura?.classList.remove('hidden');
      boxCambio?.classList.add('hidden');
      boxRep?.classList.add('hidden');
      if (tituloMontura) tituloMontura.textContent = 'Selección de Montura de Vitrina';
      this.nuevoContrato.montura_tipo = 'inventario_local';

      rowMontura?.classList.remove('hidden');
      rowLunas?.classList.remove('hidden');
      rowServicio?.classList.add('hidden');
      rowMedicion?.classList.add('hidden');
      rowAdicionales?.classList.remove('hidden');
      if (badgePasoResumen) badgePasoResumen.textContent = '6';
    } else if (tipo === 'cambio_montura') {
      secReceta?.classList.remove('hidden');
      boxLunasSpecs?.classList.add('hidden');
      secMontura?.classList.remove('hidden');
      secAdicionales?.classList.remove('hidden');
      boxMontura?.classList.remove('hidden');
      boxCambio?.classList.remove('hidden');
      boxRep?.classList.add('hidden');
      if (tituloMontura) tituloMontura.textContent = 'Nueva Montura y Reutilización de Lunas';
      this.nuevoContrato.montura_tipo = 'inventario_local';

      rowMontura?.classList.remove('hidden');
      rowLunas?.classList.add('hidden');
      rowServicio?.classList.remove('hidden');
      if (lblNombreServicio) lblNombreServicio.textContent = 'Servicio Montaje / Adaptación:';
      rowMedicion?.classList.add('hidden');
      rowAdicionales?.classList.remove('hidden');
      if (badgePasoResumen) badgePasoResumen.textContent = '6';
    } else if (tipo === 'reparacion') {
      secReceta?.classList.add('hidden');
      boxLunasSpecs?.classList.add('hidden');
      secMontura?.classList.remove('hidden');
      secAdicionales?.classList.remove('hidden');
      boxMontura?.classList.add('hidden');
      boxCambio?.classList.add('hidden');
      boxRep?.classList.remove('hidden');
      if (tituloMontura) tituloMontura.textContent = 'Detalles de Reparación y Taller';
      this.nuevoContrato.montura_tipo = 'propia_cliente';

      rowMontura?.classList.add('hidden');
      rowLunas?.classList.add('hidden');
      rowServicio?.classList.remove('hidden');
      if (lblNombreServicio) lblNombreServicio.textContent = 'Servicio de Reparación:';
      rowMedicion?.classList.add('hidden');
      rowAdicionales?.classList.remove('hidden');
      if (badgePasoResumen) badgePasoResumen.textContent = '5';
    } else if (tipo === 'medicion') {
      // Medición visual sola: Solo mostrar datos del paciente, tipo de servicio y tabla de medidas de los ojos (OD/OI).
      // Se ocultan: lunas y tratamientos (diseño, material, tinte, filtros), paso 4 montura y paso 5 adicionales.
      secReceta?.classList.remove('hidden');
      boxLunasSpecs?.classList.add('hidden');
      secMontura?.classList.add('hidden');
      secAdicionales?.classList.add('hidden');
      this.nuevoContrato.montura_tipo = 'ninguna';

      rowMontura?.classList.add('hidden');
      rowLunas?.classList.add('hidden');
      rowServicio?.classList.add('hidden');
      rowMedicion?.classList.remove('hidden');
      rowAdicionales?.classList.add('hidden');
      if (badgePasoResumen) badgePasoResumen.textContent = '4';
    }

    this.actualizarPrecios();
  },

  // Cálculo automático de esfera de cerca (ADD + Lejos)
  calcularCerca(ojo) {
    const esferaInput = document.getElementById(`rec-${ojo}-esfera`);
    const addInput = document.getElementById(`rec-${ojo}-add`);
    const cercaInput = document.getElementById(`rec-${ojo}-esfera-cerca`);

    if (!esferaInput || !addInput || !cercaInput) return;

    const valEsfera = parseFloat(esferaInput.value);
    const valAdd = parseFloat(addInput.value);

    if (!isNaN(valEsfera) && !isNaN(valAdd)) {
      const cerca = valEsfera + valAdd;
      const signo = cerca > 0 ? '+' : (cerca < 0 ? '' : '+');
      cercaInput.value = `${signo}${cerca.toFixed(2)}`;
    } else if (!isNaN(valEsfera) && isNaN(valAdd)) {
      cercaInput.value = '';
    }
  },

  // Autocomplete y Gestión de Clientes
  async buscarClientes(termino) {
    const resEl = document.getElementById('wizard-cliente-resultados');
    if (!resEl) return;

    if (!termino || termino.trim().length < 2) {
      resEl.classList.add('hidden');
      return;
    }

    try {
      const res = await api.get('/clientes', { search: termino.trim() });
      const clientes = res.data || [];
      if (clientes.length === 0) {
        resEl.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem">No se encontraron clientes. Puedes registrarlo arriba.</div>`;
        resEl.classList.remove('hidden');
        return;
      }

      resEl.innerHTML = clientes.slice(0, 8).map(cl => `
        <div class="optica-item-hover" style="padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--bg-secondary)" onclick="window.optica.seleccionarCliente(${JSON.stringify(cl).replace(/"/g, '&quot;')})">
          <div style="font-weight: 600">${cl.nombre}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary)">
            ${cl.tipo_documento || 'Doc'}: ${cl.dni_ruc || '—'} · Tel: ${cl.telefono || '—'}
            ${cl.edad ? ` · ${cl.edad} años` : ''}
          </div>
        </div>
      `).join('');
      resEl.classList.remove('hidden');
    } catch (e) {
      console.warn('Error buscando clientes:', e);
    }
  },

  seleccionarCliente(cliente) {
    this.nuevoContrato.cliente = cliente;
    document.getElementById('wizard-cliente-resultados')?.classList.add('hidden');
    document.getElementById('box-cliente-busqueda')?.classList.add('hidden');

    const selBox = document.getElementById('box-cliente-seleccionado');
    if (selBox) selBox.classList.remove('hidden');

    document.getElementById('w-clie-nombre').textContent = cliente.nombre;
    document.getElementById('w-clie-doc').textContent = `${cliente.tipo_documento || 'DNI'}: ${cliente.dni_ruc || '—'}`;
    document.getElementById('w-clie-tel').textContent = cliente.telefono || '—';
    document.getElementById('w-clie-edad').textContent = cliente.edad ? `${cliente.edad} años` : (cliente.fecha_nacimiento ? `${this.calcularEdad(cliente.fecha_nacimiento)} años` : 'No especificada');

    // Verificar si el cliente tiene recetas registradas
    this.verificarRecetasPreviasCliente(cliente.id);
  },

  deseleccionarCliente() {
    this.nuevoContrato.cliente = null;
    document.getElementById('box-cliente-busqueda')?.classList.remove('hidden');
    document.getElementById('box-cliente-seleccionado')?.classList.add('hidden');
    document.getElementById('wizard-cliente-input').value = '';
    document.getElementById('btn-cargar-ultima-receta')?.classList.add('hidden');
  },

  async verificarRecetasPreviasCliente(clienteId) {
    try {
      const res = await api.get(`/optica/recetas/cliente/${clienteId}`);
      const btnCargar = document.getElementById('btn-cargar-ultima-receta');
      if (res.success && res.data && res.data.length > 0) {
        this.clienteUltimaReceta = res.data[0];
        if (btnCargar) btnCargar.classList.remove('hidden');
      } else {
        if (btnCargar) btnCargar.classList.add('hidden');
      }
    } catch (e) {
      console.warn('Error verificando recetas previas:', e);
    }
  },

  cargarUltimaRecetaCliente() {
    if (!this.clienteUltimaReceta) return;
    const r = this.clienteUltimaReceta;

    document.getElementById('rec-od-esfera').value = r.od_esfera || '';
    document.getElementById('rec-od-cilindro').value = r.od_cilindro || '';
    document.getElementById('rec-od-eje').value = r.od_eje || '';
    document.getElementById('rec-od-dp').value = r.od_dp || '';
    document.getElementById('rec-od-add').value = r.od_adicion || '';
    document.getElementById('rec-od-esfera-cerca').value = r.od_esfera_cerca || '';
    document.getElementById('rec-od-dp-cerca').value = r.od_dp_cerca || '';

    document.getElementById('rec-oi-esfera').value = r.oi_esfera || '';
    document.getElementById('rec-oi-cilindro').value = r.oi_cilindro || '';
    document.getElementById('rec-oi-eje').value = r.oi_eje || '';
    document.getElementById('rec-oi-dp').value = r.oi_dp || '';
    document.getElementById('rec-oi-add').value = r.oi_adicion || '';
    document.getElementById('rec-oi-esfera-cerca').value = r.oi_esfera_cerca || '';
    document.getElementById('rec-oi-dp-cerca').value = r.oi_dp_cerca || '';

    if (r.tipo_luna) document.getElementById('rec-tipo-luna').value = r.tipo_luna;
    if (r.material_luna) document.getElementById('rec-material-luna').value = r.material_luna;
    if (r.color_tinte) document.getElementById('rec-color-tinte').value = r.color_tinte;
    if (r.indicaciones) document.getElementById('rec-indicaciones').value = r.indicaciones;
    if (r.observaciones) document.getElementById('rec-observaciones').value = r.observaciones;

    // Tratamientos
    if (r.tratamientos) {
      const arr = r.tratamientos.split(',');
      document.querySelectorAll('.chk-tratamiento').forEach(chk => {
        chk.checked = arr.includes(chk.value);
      });
    }

    app.showToast('Receta previa cargada correctamente en el formulario', 'success');
  },

  // Modal Nuevo Cliente
  abrirModalNuevoCliente() {
    document.getElementById('m-clie-nombre').value = '';
    document.getElementById('m-clie-tipodoc').value = 'DNI';
    document.getElementById('m-clie-documento').value = '';
    document.getElementById('m-clie-nacimiento').value = '';
    document.getElementById('m-clie-edad').value = '';
    document.getElementById('m-clie-telefono').value = '';
    document.getElementById('m-clie-direccion').value = '';
    app.openModal('modal-optica-nuevo-cliente');
  },

  calcularEdadDesdeNacimiento() {
    const fNac = document.getElementById('m-clie-nacimiento')?.value;
    if (!fNac) return;
    const edad = this.calcularEdad(fNac);
    const edadEl = document.getElementById('m-clie-edad');
    if (edadEl) edadEl.value = edad;
  },

  calcularEdad(fechaStr) {
    if (!fechaStr) return null;
    const dob = new Date(fechaStr);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  },

  async guardarNuevoCliente() {
    const nombre = document.getElementById('m-clie-nombre')?.value?.trim();
    if (!nombre) {
      app.showToast('El nombre del cliente es obligatorio', 'error');
      return;
    }

    const payload = {
      nombre,
      tipo_documento: document.getElementById('m-clie-tipodoc')?.value || 'DNI',
      dni_ruc: document.getElementById('m-clie-documento')?.value?.trim() || null,
      fecha_nacimiento: document.getElementById('m-clie-nacimiento')?.value || null,
      edad: parseInt(document.getElementById('m-clie-edad')?.value) || null,
      telefono: document.getElementById('m-clie-telefono')?.value?.trim() || null,
      direccion: document.getElementById('m-clie-direccion')?.value?.trim() || null
    };

    try {
      const res = await api.post('/clientes', payload);
      if (res.success) {
        app.showToast('Cliente registrado con éxito', 'success');
        app.closeModal('modal-optica-nuevo-cliente');
        this.seleccionarCliente(res.data);
      }
    } catch (e) {
      app.showToast('Error registrando cliente: ' + e.message, 'error');
    }
  },

  // Monturas de Vitrina y Catálogo General
  async cargarCatalogoMonturas() {
    try {
      const activeSucursal = localStorage.getItem('activeSucursal') || 1;
      const res = await api.get('/optica/monturas', { sucursal_id: activeSucursal });
      if (res.success) {
        this.monturasCatalogo = res.data || [];
      }
    } catch (e) {
      console.warn('Error cargando monturas:', e);
    }
  },

  async cargarCatalogoGeneral() {
    try {
      const activeSucursal = localStorage.getItem('activeSucursal') || 1;
      const res = await api.get('/productos', { sucursal_id: activeSucursal, limit: 500 });
      if (res.success && Array.isArray(res.data)) {
        const flatItems = [];
        res.data.forEach(p => {
          if (p.tiene_variantes && Array.isArray(p.variantes) && p.variantes.length > 0) {
            p.variantes.forEach(v => {
              flatItems.push({
                producto_id: p.id,
                variante_id: v.id,
                producto_nombre: p.nombre,
                nombre_variante: v.nombre_variante,
                producto_codigo: p.codigo,
                variante_sku: v.sku,
                codigo: v.sku, // Para búsqueda por JM-VAR-xxxxxx
                categoria_nombre: p.categoria_nombre,
                material_nombre: p.material_nombre,
                precio_venta: parseFloat(v.precio_venta || p.precio_venta || 0),
                stock_actual: parseInt(v.stock_actual || 0, 10)
              });
            });
          } else {
            flatItems.push({
              producto_id: p.id,
              variante_id: null,
              producto_nombre: p.nombre,
              nombre_variante: '',
              producto_codigo: p.codigo,
              variante_sku: null,
              codigo: p.codigo, // Para búsqueda por JM-PRD-xxxxxx
              categoria_nombre: p.categoria_nombre,
              material_nombre: p.material_nombre,
              precio_venta: parseFloat(p.precio_venta || 0),
              stock_actual: parseInt(p.stock_actual || 0, 10)
            });
          }
        });
        this.todosLosProductos = flatItems;
      }
    } catch (e) {
      console.warn('Error cargando catálogo general:', e);
    }
  },

  buscarMonturas(termino) {
    const resEl = document.getElementById('lista-resultados-monturas');
    if (!resEl) return;

    if (!termino || termino.trim().length < 1) {
      resEl.classList.add('hidden');
      return;
    }

    const term = termino.toLowerCase();
    const matches = this.monturasCatalogo.filter(m => {
      const nProd = (m.producto_nombre || '').toLowerCase();
      const nVar = (m.nombre_variante || '').toLowerCase();
      const sku = (m.variante_sku || m.producto_codigo || '').toLowerCase();
      const cat = (m.categoria_nombre || '').toLowerCase();
      return nProd.includes(term) || nVar.includes(term) || sku.includes(term) || cat.includes(term);
    });

    if (matches.length === 0) {
      resEl.innerHTML = `<div style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem; text-align: center">🔍 No se encontraron monturas que coincidan con "<strong>${termino}</strong>".</div>`;
      resEl.classList.remove('hidden');
      return;
    }

    resEl.innerHTML = matches.slice(0, 15).map(m => {
      const nombreCompleto = m.variante_id ? `${m.producto_nombre} · ${m.nombre_variante}` : m.producto_nombre;
      const stockLocal = parseInt(m.stock_actual || 0);
      const stockBadge = stockLocal > 0 
        ? `<span class="badge badge-success" style="font-size: 0.78rem; padding: 3px 8px">${stockLocal} en tienda</span>` 
        : `<span class="badge badge-danger" style="font-size: 0.78rem; padding: 3px 8px">Agotado local</span>`;

      return `
        <div class="optica-item-hover" style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--bg-secondary); display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="window.optica.seleccionarMontura(${JSON.stringify(m).replace(/"/g, '&quot;')})">
          <div style="display:flex; align-items:center; gap:0.75rem">
            <span style="font-size: 1.4rem">👓</span>
            <div>
              <div style="font-weight: 700; font-size: 0.98rem; color: var(--text-primary)">${nombreCompleto}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px">
                Cód: <span style="font-family: monospace; font-weight: 600">${m.variante_sku || m.producto_codigo || '—'}</span> · <span class="badge badge-secondary" style="font-size:0.75rem">${m.categoria_nombre || 'Vitrina'}</span>
              </div>
            </div>
          </div>
          <div style="text-align: right; display:flex; align-items:center; gap:0.85rem">
            <div>
              <div class="text-gold fw-bold" style="font-size: 1.05rem">S/ ${parseFloat(m.precio_venta || 0).toFixed(2)}</div>
              ${stockBadge}
            </div>
            <button type="button" class="btn btn-primary btn-sm" style="padding: 4px 12px; font-weight: 700; font-size: 0.82rem">
              Elegir ➔
            </button>
          </div>
        </div>
      `;
    }).join('');
    resEl.classList.remove('hidden');
  },

  seleccionarMontura(m) {
    const stockLocal = parseInt(m.stock_actual || 0);
    if (stockLocal < 1) {
      const enOtras = (m.stock_sucursales || []).filter(s => s.stock_actual > 0);
      let msgOtras = '';
      if (enOtras.length > 0) {
        msgOtras = ` Hay stock disponible en: ${enOtras.map(s => `${s.sucursal_nombre} (${s.stock_actual} unid.)`).join(', ')}. Debes generar un traslado inter-tienda.`;
      }
      app.showToast(`⚠️ Esta montura no tiene stock en tu sucursal actual.${msgOtras}`, 'warning');
    }

    this.nuevoContrato.montura_producto_id = m.producto_id;
    this.nuevoContrato.montura_variante_id = m.variante_id || null;
    this.nuevoContrato.montura_descripcion = m.variante_id ? `${m.producto_nombre} · ${m.nombre_variante}` : m.producto_nombre;
    this.nuevoContrato.montura_precio = parseFloat(m.precio_venta || 0);
    this.nuevoContrato.montura_stock_actual = stockLocal;

    document.getElementById('lista-resultados-monturas')?.classList.add('hidden');
    const inputBusqueda = document.getElementById('input-buscar-montura');
    if (inputBusqueda) inputBusqueda.value = '';

    // Ocultar buscador y mostrar ficha de selección prominente
    const boxBuscador = document.getElementById('box-buscador-monturas');
    if (boxBuscador) boxBuscador.classList.add('hidden');

    const boxSel = document.getElementById('box-montura-seleccionada');
    if (boxSel) boxSel.classList.remove('hidden');

    document.getElementById('montura-sel-nombre').textContent = this.nuevoContrato.montura_descripcion;
    document.getElementById('montura-sel-codigo').textContent = m.variante_sku || m.producto_codigo || '—';
    document.getElementById('montura-sel-vitrina').textContent = m.categoria_nombre || 'Vitrina';
    
    const stockLbl = document.getElementById('montura-sel-stock');
    if (stockLbl) {
      stockLbl.textContent = `${stockLocal} unid.`;
      stockLbl.className = stockLocal > 0 ? 'badge badge-success' : 'badge badge-danger';
    }

    const precioInput = document.getElementById('montura-sel-precio-input');
    if (precioInput) precioInput.value = this.nuevoContrato.montura_precio.toFixed(2);

    this.actualizarPrecios();
  },

  deseleccionarMontura() {
    this.nuevoContrato.montura_producto_id = null;
    this.nuevoContrato.montura_variante_id = null;
    this.nuevoContrato.montura_descripcion = '';
    this.nuevoContrato.montura_precio = 0;
    this.nuevoContrato.montura_stock_actual = 0;

    // Mostrar de nuevo el buscador y ocultar la ficha
    const boxBuscador = document.getElementById('box-buscador-monturas');
    if (boxBuscador) boxBuscador.classList.remove('hidden');

    const boxSel = document.getElementById('box-montura-seleccionada');
    if (boxSel) boxSel.classList.add('hidden');

    const inputBusqueda = document.getElementById('input-buscar-montura');
    if (inputBusqueda) {
      inputBusqueda.value = '';
      inputBusqueda.focus();
    }

    this.actualizarPrecios();
  },

  abrirScannerMontura() {
    scanner.open((codigoDetectado) => {
      if (codigoDetectado) {
        const input = document.getElementById('input-buscar-montura');
        if (input) input.value = codigoDetectado;
        this.buscarMonturas(codigoDetectado);
      }
    });
  },

  // ==========================================================================
  // GESTIÓN DE PRODUCTOS Y ACCESORIOS ADICIONALES AL CONTRATO
  // ==========================================================================
  async buscarAdicionales(termino) {
    const resEl = document.getElementById('lista-resultados-adicionales');
    if (!resEl) return;

    if (!termino || termino.trim().length < 1) {
      resEl.classList.add('hidden');
      return;
    }

    const term = termino.trim().toLowerCase();
    const source = (this.todosLosProductos && this.todosLosProductos.length > 0) 
      ? this.todosLosProductos 
      : this.monturasCatalogo;

    // 1. Filtrado local rápido en memoria (soporta código SKU de variante ej. JM-VAR-..., código producto, nombre, etc.)
    let matches = source.filter(p => {
      const n = (p.producto_nombre || p.nombre || '').toLowerCase();
      const v = (p.nombre_variante || '').toLowerCase();
      const c = (p.codigo || p.variante_sku || p.producto_codigo || '').toLowerCase();
      const skuVar = (p.variante_sku || '').toLowerCase();
      const skuProd = (p.producto_codigo || '').toLowerCase();
      const cat = (p.categoria_nombre || '').toLowerCase();
      return c.includes(term) || skuVar.includes(term) || skuProd.includes(term) || n.includes(term) || v.includes(term) || cat.includes(term);
    });

    // 2. Si no hay suficientes resultados o es búsqueda directa por código (ej. "JM-", "VAR", números), consultar al endpoint backend
    if (matches.length < 5 || term.startsWith('jm-') || term.includes('var') || term.length >= 3) {
      try {
        const activeSucursal = localStorage.getItem('activeSucursal') || 1;
        const srvRes = await api.get('/optica/buscar-adicional', { q: termino.trim(), sucursal_id: activeSucursal });
        if (srvRes.success && Array.isArray(srvRes.data) && srvRes.data.length > 0) {
          const seen = new Set(matches.map(m => `${m.producto_id || m.id}-${m.variante_id || 'null'}`));
          srvRes.data.forEach(item => {
            const key = `${item.producto_id}-${item.variante_id || 'null'}`;
            if (!seen.has(key)) {
              seen.add(key);
              matches.push(item);
            }
          });
        }
      } catch (err) {
        // En caso de desconexión, se conservan los resultados locales
      }
    }

    if (matches.length === 0) {
      resEl.innerHTML = `
        <div style="padding: 1rem; color: var(--text-muted); font-size: 0.88rem; text-align: center">
          No se encontraron productos o subproductos con "<strong>${termino}</strong>". Puedes agregarlo manualmente con el botón <strong>+ Manual</strong>.
        </div>
      `;
      resEl.classList.remove('hidden');
      return;
    }

    resEl.innerHTML = matches.slice(0, 25).map(m => {
      const prodId = m.producto_id || m.id;
      const varId = m.variante_id || null;
      const nombreCompleto = varId ? `${m.producto_nombre || m.nombre} · ${m.nombre_variante}` : (m.producto_nombre || m.nombre);
      const stockLocal = parseInt(m.stock_actual || 0);
      const precio = parseFloat(m.precio_venta || 0);
      const codigo = m.variante_sku || m.codigo || m.producto_codigo || '—';

      return `
        <div class="optica-item-hover" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--bg-secondary); display:flex; justify-content:space-between; align-items:center; cursor:pointer" onclick="window.optica.agregarProductoAdicional(${JSON.stringify(m).replace(/"/g, '&quot;')})">
          <div style="display:flex; align-items:center; gap:0.65rem">
            <span style="font-size:1.3rem">📦</span>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary)">${nombreCompleto}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top:2px">
                Cód: <span style="font-family:monospace; font-weight:700; color:var(--accent-gold-dark); background:rgba(201,169,110,0.14); padding:1px 6px; border-radius:4px">${codigo}</span> · ${m.categoria_nombre || 'General'} · <span class="badge ${stockLocal > 0 ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem">${stockLocal} disp.</span>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.85rem">
            <span class="text-gold fw-bold" style="font-size: 1.05rem">S/ ${precio.toFixed(2)}</span>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.8rem; font-weight: 600">
              + Agregar
            </button>
          </div>
        </div>
      `;
    }).join('');
    resEl.classList.remove('hidden');
  },

  abrirScannerAdicional() {
    scanner.open((codigoDetectado) => {
      if (codigoDetectado) {
        const input = document.getElementById('input-buscar-adicional');
        if (input) input.value = codigoDetectado;
        this.buscarAdicionales(codigoDetectado);
      }
    });
  },

  agregarProductoAdicional(p) {
    if (!this.nuevoContrato.productos_adicionales) this.nuevoContrato.productos_adicionales = [];
    const prodId = p.producto_id || p.id;
    const varId = p.variante_id || null;
    const desc = varId ? `${p.producto_nombre || p.nombre} · ${p.nombre_variante}` : (p.producto_nombre || p.nombre);
    const precio = parseFloat(p.precio_venta || 0);

    // Si ya existe en la lista, sumar 1
    const existente = this.nuevoContrato.productos_adicionales.find(x => x.producto_id === prodId && x.variante_id === varId);
    if (existente) {
      existente.cantidad += 1;
    } else {
      this.nuevoContrato.productos_adicionales.push({
        producto_id: prodId,
        variante_id: varId,
        descripcion: desc,
        cantidad: 1,
        precio_unitario: precio
      });
    }

    const inputAdic = document.getElementById('input-buscar-adicional');
    if (inputAdic) inputAdic.value = '';
    document.getElementById('lista-resultados-adicionales')?.classList.add('hidden');

    this.renderTablaAdicionales();
    this.actualizarPrecios();
  },

  renderTablaAdicionales() {
    const tbody = document.getElementById('tbody-adicionales');
    const vacio = document.getElementById('vacio-adicionales');
    const wrapper = document.getElementById('tabla-adicionales-wrapper');
    if (!tbody || !vacio || !wrapper) return;

    const lista = this.nuevoContrato.productos_adicionales || [];
    if (lista.length === 0) {
      vacio.classList.remove('hidden');
      wrapper.classList.add('hidden');
      return;
    }

    vacio.classList.add('hidden');
    wrapper.classList.remove('hidden');

    tbody.innerHTML = lista.map((it, idx) => {
      const subtotal = it.cantidad * it.precio_unitario;
      return `
        <tr>
          <td style="font-weight: 600; vertical-align: middle">
            <div style="display:flex; align-items:center; gap:6px">
              <span>📦</span>
              <span>${it.descripcion}</span>
            </div>
          </td>
          <td style="text-align: center; vertical-align: middle">
            <div style="display:inline-flex; align-items:center; gap:4px">
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; height:28px; font-weight:bold" onclick="window.optica.cambiarCantAdicional(${idx}, -1)">-</button>
              <span style="font-weight:bold; min-width:28px; text-align:center; font-size:0.95rem">${it.cantidad}</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; height:28px; font-weight:bold" onclick="window.optica.cambiarCantAdicional(${idx}, 1)">+</button>
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle">
            <div style="display:inline-flex; align-items:center; gap:4px">
              <span class="text-muted" style="font-size:0.85rem">S/</span>
              <input type="number" class="form-control text-right" style="width:85px; height:32px; padding:2px 6px; font-weight:700" value="${it.precio_unitario.toFixed(2)}" min="0" step="0.5" oninput="window.optica.cambiarPrecioAdicional(${idx}, this.value)">
            </div>
          </td>
          <td style="text-align: right; font-weight: 800; color: var(--accent-gold-dark); vertical-align: middle; font-size: 1rem">
            S/ ${subtotal.toFixed(2)}
          </td>
          <td style="text-align: center; vertical-align: middle">
            <button type="button" class="btn btn-icon btn-sm text-danger" onclick="window.optica.eliminarAdicional(${idx})" title="Quitar ítem" style="height:32px; width:32px">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  cambiarCantAdicional(idx, delta) {
    const it = this.nuevoContrato.productos_adicionales[idx];
    if (!it) return;
    it.cantidad += delta;
    if (it.cantidad <= 0) {
      this.nuevoContrato.productos_adicionales.splice(idx, 1);
    }
    this.renderTablaAdicionales();
    this.actualizarPrecios();
  },

  cambiarPrecioAdicional(idx, nuevoPrecio) {
    const it = this.nuevoContrato.productos_adicionales[idx];
    if (!it) return;
    it.precio_unitario = Math.max(0, parseFloat(nuevoPrecio || 0));
    this.renderTablaAdicionales();
    this.actualizarPrecios();
  },

  eliminarAdicional(idx) {
    this.nuevoContrato.productos_adicionales.splice(idx, 1);
    this.renderTablaAdicionales();
    this.actualizarPrecios();
  },

  abrirModalItemManual() {
    const desc = prompt('Nombre o descripción del producto/accesorio adicional (ej. Estuche rígido, Paño microfibra):');
    if (!desc || !desc.trim()) return;
    const precioStr = prompt('Precio unitario en Soles (S/.):', '10.00');
    const precio = parseFloat(precioStr || 0);

    if (!this.nuevoContrato.productos_adicionales) this.nuevoContrato.productos_adicionales = [];
    this.nuevoContrato.productos_adicionales.push({
      producto_id: null,
      variante_id: null,
      descripcion: desc.trim(),
      cantidad: 1,
      precio_unitario: isNaN(precio) ? 0 : Math.max(0, precio)
    });
    this.renderTablaAdicionales();
    this.actualizarPrecios();
  },

  // Cálculo algebraico de esfera de cerca (Esfera Lejos + Adición)
  calcularEsferaCerca(esferaStr, adicionStr) {
    if (!esferaStr || !adicionStr) return null;
    const esf = parseFloat(String(esferaStr).replace(',', '.'));
    const add = parseFloat(String(adicionStr).replace(',', '.'));
    if (isNaN(esf) || isNaN(add)) return null;
    const cerca = esf + add;
    const signo = cerca > 0 ? '+' : (cerca < 0 ? '' : '+');
    return `${signo}${cerca.toFixed(2)}`;
  },

  calcularCerca(ojo) {
    const esferaInput = document.getElementById(`rec-${ojo}-esfera`);
    const addInput = document.getElementById(`rec-${ojo}-add`);
    const cercaInput = document.getElementById(`rec-${ojo}-esfera-cerca`);

    if (!esferaInput || !addInput || !cercaInput) return;

    const res = this.calcularEsferaCerca(esferaInput.value, addInput.value);
    cercaInput.value = res || '—';
  },

  recolectarTratamientos() {
    const trat = [];
    document.querySelectorAll('.chk-tratamiento:checked').forEach(c => trat.push(c.value));
    this.nuevoContrato.receta.tratamientos = trat;
  },

  // Resumen Económico Reactivo
  actualizarPrecios() {
    const tipo = this.nuevoContrato.tipo_servicio;
    let costoMontura = 0;
    let costoLunas = 0;
    let costoServicio = 0;

    if (tipo === 'completo') {
      const inputPr = document.getElementById('montura-sel-precio-input');
      costoMontura = inputPr ? parseFloat(inputPr.value || 0) : (this.nuevoContrato.montura_precio || 0);
      costoLunas = parseFloat(document.getElementById('w-costo-lunas')?.value || 0);
      costoServicio = 0;
    } else if (tipo === 'cambio_montura') {
      const inputPr = document.getElementById('montura-sel-precio-input');
      costoMontura = inputPr ? parseFloat(inputPr.value || 0) : (this.nuevoContrato.montura_precio || 0);
      costoServicio = parseFloat(document.getElementById('cambio-costo-montaje')?.value || 0);
      costoLunas = 0;
    } else if (tipo === 'reparacion') {
      costoMontura = 0;
      costoLunas = 0;
      costoServicio = parseFloat(document.getElementById('rep-costo')?.value || 0);
    } else if (tipo === 'medicion') {
      costoMontura = 0;
      costoLunas = 0;
      costoServicio = parseFloat(document.getElementById('w-costo-medicion')?.value || 0);
    }

    // Calcular costo de productos y accesorios adicionales (solo si no es medición)
    let costoAdicionales = 0;
    if (tipo !== 'medicion') {
      (this.nuevoContrato.productos_adicionales || []).forEach(item => {
        costoAdicionales += (item.cantidad * item.precio_unitario);
      });
    }

    const descuento = parseFloat(document.getElementById('w-descuento')?.value || 0);
    const subtotal = costoMontura + costoLunas + costoServicio + costoAdicionales;
    const total = Math.max(0, subtotal - descuento);

    // Actualizar etiquetas
    const elLblMontura = document.getElementById('lbl-costo-montura');
    if (elLblMontura) elLblMontura.textContent = `S/ ${costoMontura.toFixed(2)}`;

    const elLblServicio = document.getElementById('lbl-costo-servicio');
    if (elLblServicio) elLblServicio.textContent = `S/ ${costoServicio.toFixed(2)}`;

    const elLblAdicionales = document.getElementById('lbl-costo-adicionales');
    if (elLblAdicionales) elLblAdicionales.textContent = `S/ ${costoAdicionales.toFixed(2)}`;

    const elLblTotalAdicBox = document.getElementById('lbl-total-adicionales-box');
    if (elLblTotalAdicBox) elLblTotalAdicBox.textContent = `S/ ${costoAdicionales.toFixed(2)}`;

    const elLblTotal = document.getElementById('lbl-costo-total');
    if (elLblTotal) elLblTotal.textContent = `S/ ${total.toFixed(2)}`;

    const elPreview = document.getElementById('resumen-total-preview');
    if (elPreview) elPreview.textContent = `Total: S/ ${total.toFixed(2)}`;

    // Saldo
    const adelantoInput = document.getElementById('w-adelanto');
    let adelanto = adelantoInput ? parseFloat(adelantoInput.value || 0) : 0;
    if (adelanto > total) {
      adelanto = total;
      if (adelantoInput) adelantoInput.value = total.toFixed(2);
    }
    const saldo = Math.max(0, total - adelanto);

    const elSaldo = document.getElementById('lbl-saldo-pendiente');
    if (elSaldo) {
      elSaldo.textContent = `S/ ${saldo.toFixed(2)}`;
      elSaldo.style.color = saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)';
    }

    this.nuevoContrato.total = total;
    this.nuevoContrato.subtotal = subtotal;
    this.nuevoContrato.descuento = descuento;
  },

  setAdelanto(porcentaje) {
    const total = this.nuevoContrato.total || 0;
    const monto = total * porcentaje;
    const input = document.getElementById('w-adelanto');
    if (input) {
      input.value = monto.toFixed(2);
      this.actualizarPrecios();
    }
  },

  cambiarMetodoPago() {
    const met = document.getElementById('w-metodo-pago')?.value;
    const boxMixto = document.getElementById('box-pago-mixto');
    if (boxMixto) {
      boxMixto.classList.toggle('hidden', met !== 'mixto');
    }
  },

  // Guardar Contrato Final
  async guardarContrato() {
    const btn = document.getElementById('btn-guardar-contrato');
    if (btn) btn.disabled = true;

    try {
      if (!this.nuevoContrato.cliente) {
        throw new Error('Debes seleccionar o registrar al cliente en el Paso 1.');
      }

      const tipo = this.nuevoContrato.tipo_servicio;
      const sucursalId = localStorage.getItem('activeSucursal') || 1;

      // Validar montura de inventario local
      if ((tipo === 'completo' || tipo === 'cambio_montura') && !this.nuevoContrato.montura_producto_id) {
        throw new Error('Debes seleccionar una montura de vitrina en el Paso 4.');
      }

      // Validar stock preventivo si es montura de vitrina
      if ((tipo === 'completo' || tipo === 'cambio_montura') && this.nuevoContrato.montura_stock_actual < 1) {
        const confirmar = confirm('⚠️ La montura seleccionada registra stock 0 en esta tienda. ¿Deseas continuar bajo pedido especial?');
        if (!confirmar) {
          if (btn) btn.disabled = false;
          return;
        }
      }

      // Preparar payload de receta si aplica
      let recetaPayload = null;
      if (tipo === 'completo' || tipo === 'cambio_montura' || tipo === 'medicion') {
        const odEsfera = document.getElementById('rec-od-esfera')?.value;
        const oiEsfera = document.getElementById('rec-oi-esfera')?.value;
        const odAdd = document.getElementById('rec-od-add')?.value;
        const oiAdd = document.getElementById('rec-oi-add')?.value;

        recetaPayload = {
          od_esfera: odEsfera || null,
          od_cilindro: document.getElementById('rec-od-cilindro')?.value || null,
          od_eje: parseInt(document.getElementById('rec-od-eje')?.value) || null,
          od_dp: null,
          oi_esfera: oiEsfera || null,
          oi_cilindro: document.getElementById('rec-oi-cilindro')?.value || null,
          oi_eje: parseInt(document.getElementById('rec-oi-eje')?.value) || null,
          oi_dp: null,
          od_adicion: odAdd || null,
          oi_adicion: oiAdd || null,
          od_esfera_cerca: this.calcularEsferaCerca(odEsfera, odAdd),
          oi_esfera_cerca: this.calcularEsferaCerca(oiEsfera, oiAdd),
          od_dp_cerca: null,
          oi_dp_cerca: null,
          tipo_luna: tipo === 'medicion' ? null : (document.getElementById('rec-tipo-luna')?.value || 'monofocal'),
          material_luna: tipo === 'medicion' ? null : (document.getElementById('rec-material-luna')?.value || 'resina_cr39'),
          tratamientos: tipo === 'medicion' ? '' : (this.nuevoContrato.receta?.tratamientos || []).join(','),
          color_tinte: tipo === 'medicion' ? null : (document.getElementById('rec-color-tinte')?.value || ''),
          indicaciones: document.getElementById('rec-indicaciones')?.value || '',
          observaciones: document.getElementById('rec-observaciones')?.value || ''
        };
      }

      // Desglose de ítems
      const items = [];
      const prMontura = parseFloat(document.getElementById('montura-sel-precio-input')?.value || this.nuevoContrato.montura_precio || 0);
      const prLunas = parseFloat(document.getElementById('w-costo-lunas')?.value || 0);
      const prRep = parseFloat(document.getElementById('rep-costo')?.value || 0);
      const prMontaje = parseFloat(document.getElementById('cambio-costo-montaje')?.value || 0);
      const prMedicion = parseFloat(document.getElementById('w-costo-medicion')?.value || 0);

      if ((tipo === 'completo' || tipo === 'cambio_montura') && this.nuevoContrato.montura_producto_id) {
        items.push({
          tipo_item: 'montura',
          producto_id: this.nuevoContrato.montura_producto_id,
          variante_id: this.nuevoContrato.montura_variante_id,
          descripcion: this.nuevoContrato.montura_descripcion,
          cantidad: 1,
          precio_unitario: prMontura,
          descuento_item: 0,
          subtotal_item: prMontura
        });
      }

      if (tipo === 'completo' && prLunas > 0) {
        const disLuna = document.getElementById('rec-tipo-luna')?.value || 'Monofocal';
        const matLuna = document.getElementById('rec-material-luna')?.value || 'CR-39';
        const tratam = (this.nuevoContrato.receta?.tratamientos || []).join(', ');
        items.push({
          tipo_item: 'lunas',
          descripcion: `Lunas oftálmicas: ${disLuna} (${matLuna})${tratam ? ' - ' + tratam : ''}`,
          cantidad: 1,
          precio_unitario: prLunas,
          descuento_item: 0,
          subtotal_item: prLunas
        });
      }

      if (tipo === 'cambio_montura' && prMontaje > 0) {
        items.push({
          tipo_item: 'servicio',
          descripcion: 'Servicio de montaje y adaptación de lunas reutilizadas',
          cantidad: 1,
          precio_unitario: prMontaje,
          descuento_item: 0,
          subtotal_item: prMontaje
        });
      }

      if (tipo === 'reparacion') {
        const descRep = document.getElementById('rep-descripcion')?.value || 'Reparación de montura';
        items.push({
          tipo_item: 'servicio',
          descripcion: descRep,
          cantidad: 1,
          precio_unitario: prRep,
          descuento_item: 0,
          subtotal_item: prRep
        });
      }

      if (tipo === 'medicion') {
        items.push({
          tipo_item: 'servicio',
          descripcion: 'Servicio de medición de vista / Examen visual' + (prMedicion === 0 ? ' (Cortesía / Gratuito)' : ''),
          cantidad: 1,
          precio_unitario: prMedicion,
          descuento_item: 0,
          subtotal_item: prMedicion
        });
      }

      // Incorporar productos y accesorios adicionales elegidos (solo si no es medición)
      if (tipo !== 'medicion') {
        (this.nuevoContrato.productos_adicionales || []).forEach(ad => {
          items.push({
            tipo_item: 'accesorio',
            producto_id: ad.producto_id || null,
            variante_id: ad.variante_id || null,
            descripcion: ad.descripcion,
            cantidad: ad.cantidad,
            precio_unitario: ad.precio_unitario,
            descuento_item: 0,
            subtotal_item: ad.cantidad * ad.precio_unitario
          });
        });
      }

      const totalCalculado = this.nuevoContrato.total || 0;
      const adelanto = parseFloat(document.getElementById('w-adelanto')?.value || 0);
      const metodoPago = document.getElementById('w-metodo-pago')?.value || 'efectivo';

      const payload = {
        cliente_id: this.nuevoContrato.cliente.id,
        edad_atencion: this.nuevoContrato.cliente.edad || null,
        tipo_servicio: tipo,
        sucursal_id: sucursalId,
        montura_tipo: this.nuevoContrato.montura_tipo,
        montura_producto_id: this.nuevoContrato.montura_producto_id,
        montura_variante_id: this.nuevoContrato.montura_variante_id,
        montura_descripcion: this.nuevoContrato.montura_descripcion,
        montura_observaciones_lunas_cliente: document.getElementById('cambio-obs-lunas')?.value || '',
        fecha_estimada_entrega: document.getElementById('w-fecha-entrega')?.value || null,
        responsable_taller: document.getElementById('rep-tecnico')?.value || '',
        observaciones: document.getElementById('w-observaciones')?.value || '',
        subtotal: this.nuevoContrato.subtotal || totalCalculado,
        descuento: this.nuevoContrato.descuento || 0,
        total: totalCalculado,
        monto_adelanto: adelanto,
        metodo_pago: metodoPago,
        monto_efectivo: metodoPago === 'mixto' ? parseFloat(document.getElementById('w-monto-efectivo')?.value || 0) : null,
        monto_yape: metodoPago === 'mixto' ? parseFloat(document.getElementById('w-monto-yape')?.value || 0) : null,
        items,
        receta: recetaPayload
      };

      const res = await api.post('/optica/contratos', payload);
      if (res.success) {
        app.showToast('¡Contrato y orden de trabajo generados con éxito!', 'success');
        this.mostrarModalExito(res.data);
        this.resetNuevoContrato();
      }
    } catch (err) {
      app.showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  mostrarModalExito(contrato) {
    document.getElementById('exito-codigo-contrato').textContent = contrato.codigo_contrato;
    document.getElementById('exito-mensaje-contrato').textContent = `Cliente: ${this.nuevoContrato.cliente?.nombre || 'Cliente'}. Total: S/ ${parseFloat(contrato.total).toFixed(2)}. Saldo restante: S/ ${parseFloat(contrato.saldo_pendiente).toFixed(2)}`;

    const btnTicket = document.getElementById('btn-exito-ticket');
    if (btnTicket) {
      btnTicket.onclick = () => this.imprimirTicketContrato(contrato.id);
    }
    const btnPdf = document.getElementById('btn-exito-pdf');
    if (btnPdf) {
      btnPdf.onclick = () => this.abrirPdfContrato(contrato.id);
    }

    app.openModal('modal-optica-exito');
  },

  resetNuevoContrato() {
    this.deseleccionarCliente();
    this.deseleccionarMontura();

    // Resetear prescripción
    const elOdEsf = document.getElementById('rec-od-esfera'); if (elOdEsf) elOdEsf.value = '';
    const elOdCil = document.getElementById('rec-od-cilindro'); if (elOdCil) elOdCil.value = '';
    const elOdEje = document.getElementById('rec-od-eje'); if (elOdEje) elOdEje.value = '';
    const elOdAdd = document.getElementById('rec-od-add'); if (elOdAdd) elOdAdd.value = '';
    const elOdCerca = document.getElementById('rec-od-esfera-cerca'); if (elOdCerca) elOdCerca.value = '—';

    const elOiEsf = document.getElementById('rec-oi-esfera'); if (elOiEsf) elOiEsf.value = '';
    const elOiCil = document.getElementById('rec-oi-cilindro'); if (elOiCil) elOiCil.value = '';
    const elOiEje = document.getElementById('rec-oi-eje'); if (elOiEje) elOiEje.value = '';
    const elOiAdd = document.getElementById('rec-oi-add'); if (elOiAdd) elOiAdd.value = '';
    const elOiCerca = document.getElementById('rec-oi-esfera-cerca'); if (elOiCerca) elOiCerca.value = '—';

    // Resetear productos adicionales
    this.nuevoContrato.productos_adicionales = [];
    this.renderTablaAdicionales();
    const adicIn = document.getElementById('input-buscar-adicional');
    if (adicIn) adicIn.value = '';
    document.getElementById('lista-resultados-adicionales')?.classList.add('hidden');

    document.querySelectorAll('.chk-tratamiento').forEach(c => c.checked = false);
    const elLunas = document.getElementById('w-costo-lunas'); if (elLunas) elLunas.value = '0.00';
    const elMed = document.getElementById('w-costo-medicion'); if (elMed) elMed.value = '0.00';
    const elDesc = document.getElementById('w-descuento'); if (elDesc) elDesc.value = '0.00';
    const elAdel = document.getElementById('w-adelanto'); if (elAdel) elAdel.value = '0.00';
    const elObs = document.getElementById('w-observaciones'); if (elObs) elObs.value = '';
    const elRep = document.getElementById('rep-descripcion'); if (elRep) elRep.value = '';
    const elCamb = document.getElementById('cambio-obs-lunas'); if (elCamb) elCamb.value = '';

    this.seleccionarTipoServicio('completo');
  },

  // Iniciar Medición Visual Sola
  iniciarMedicionSola() {
    this.switchTab('nueva-atencion');
    this.seleccionarTipoServicio('medicion');
    app.showToast('Modo: Medición Visual Independiente seleccionado', 'info');
  },

  // ==========================================================================
  // TAB 3: HISTORIAL DE RECETAS
  // ==========================================================================
  async loadRecetas() {
    try {
      const res = await api.get('/optica/contratos', { limit: 200 }); // también trae recetas vinculadas
      // O consultar endpoint de recetas
      // Hacemos query a contratos o recetas
      const cRes = await api.get('/optica/contratos');
      this.recetasContratos = (cRes.data || []).filter(c => c.receta_id);
      this.renderRecetas(this.recetasContratos);
    } catch (e) {
      console.warn('Error cargando recetas:', e);
    }
  },

  renderRecetas(contratosConReceta) {
    const tbody = document.getElementById('tbody-recetas-optica');
    if (!tbody) return;

    if (contratosConReceta.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem">No hay recetas registradas todavía.</td></tr>`;
      return;
    }

    tbody.innerHTML = contratosConReceta.map(c => {
      const fecha = this.fmtFecha(c.fecha_contrato);
      return `
        <tr>
          <td><strong style="font-family: monospace">${c.codigo_contrato}</strong><br><small class="text-muted">${fecha}</small></td>
          <td><strong>${c.cliente_nombre || 'Cliente'}</strong><br><small class="text-muted">Doc: ${c.cliente_dni_ruc || '—'}</small></td>
          <td>${c.edad_atencion ? `${c.edad_atencion} años` : '—'}</td>
          <td>
            <div style="font-size: 0.85rem; font-family: monospace; background: rgba(59, 130, 246, 0.08); padding: 4px 6px; border-radius: 4px">
              OD: SPH/CYL/EJE
            </div>
          </td>
          <td>
            <div style="font-size: 0.85rem; font-family: monospace; background: rgba(16, 185, 129, 0.08); padding: 4px 6px; border-radius: 4px">
              OI: SPH/CYL/EJE
            </div>
          </td>
          <td><span class="badge badge-gold">${c.tipo_servicio}</span></td>
          <td><small class="text-muted">${c.usuario_nombre || '—'}</small></td>
          <td class="text-right">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end">
              <button class="btn btn-secondary btn-sm" title="Imprimir Ticket Receta" onclick="window.opticaPrintReceta(${c.receta_id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Ticket
              </button>
              <button class="btn btn-primary btn-sm" title="Crear Nuevo Contrato con esta Receta" onclick="window.opticaCrearContratoDesdeReceta(${c.receta_id}, ${c.cliente_id})">
                ⚡ Contrato
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filtrarRecetasLocales() {
    const term = document.getElementById('filtro-recetas-search')?.value?.toLowerCase();
    if (!term) {
      this.renderRecetas(this.recetasContratos);
      return;
    }
    const filtradas = this.recetasContratos.filter(c => {
      const nClie = (c.cliente_nombre || '').toLowerCase();
      const doc = (c.cliente_dni_ruc || '').toLowerCase();
      const cod = (c.codigo_contrato || '').toLowerCase();
      return nClie.includes(term) || doc.includes(term) || cod.includes(term);
    });
    this.renderRecetas(filtradas);
  },

  async crearContratoDesdeReceta(recetaId, clienteId) {
    try {
      const clRes = await api.get(`/clientes/${clienteId}`);
      if (clRes.success && clRes.data) {
        this.switchTab('nueva-atencion');
        this.seleccionarCliente(clRes.data);
        await this.cargarUltimaRecetaCliente();
        app.showToast('Cliente y receta listos para generar nuevo contrato', 'success');
      }
    } catch (e) {
      app.showToast('Error precargando receta: ' + e.message, 'error');
    }
  },

  // ==========================================================================
  // TAB 4: TRASLADOS DE MONTURAS
  // ==========================================================================
  async loadTraslados() {
    try {
      const res = await api.get('/optica/traslados');
      if (res.success) {
        this.traslados = res.data || [];
        this.renderTraslados();
      }
    } catch (e) {
      console.warn('Error cargando traslados:', e);
    }
  },

  renderTraslados() {
    const tbody = document.getElementById('tbody-traslados-optica');
    if (!tbody) return;

    if (this.traslados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem">No hay solicitudes de traslado registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.traslados.map(t => {
      const fecha = this.fmtFecha(t.fecha_solicitud);
      const estadoBadge = this.getEstadoTrasladoBadge(t.estado);

      return `
        <tr>
          <td><small class="text-muted">${fecha}</small></td>
          <td>
            <strong>${t.producto_nombre || 'Montura'}</strong>
            ${t.nombre_variante ? `<br><small class="text-muted">${t.nombre_variante}</small>` : ''}
          </td>
          <td><span class="badge">${t.sucursal_origen_nombre}</span></td>
          <td><span class="badge badge-gold">${t.sucursal_destino_nombre}</span></td>
          <td><small class="text-muted">${t.solicitado_por_nombre || '—'}</small></td>
          <td>${estadoBadge}</td>
          <td class="text-right">
            ${t.estado === 'solicitado' ? `
              <button class="btn btn-secondary btn-sm" onclick="window.optica.actualizarEstadoTraslado(${t.id}, 'en_transito')">
                Despachar
              </button>
            ` : ''}
            ${t.estado === 'en_transito' ? `
              <button class="btn btn-success btn-sm" onclick="window.optica.actualizarEstadoTraslado(${t.id}, 'recibido')">
                Confirmar Recepción
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  },

  async actualizarEstadoTraslado(id, nuevoEstado) {
    try {
      await api.put(`/optica/traslados/${id}/estado`, { estado: nuevoEstado });
      app.showToast('Estado de traslado actualizado', 'success');
      this.loadTraslados();
    } catch (e) {
      app.showToast('Error en traslado: ' + e.message, 'error');
    }
  },

  abrirModalSolicitarTraslado() {
    app.showToast('Selecciona la montura desde el Paso 4 en Nueva Atención para solicitar su traslado entre tiendas.', 'info');
    this.switchTab('nueva-atencion');
  },

  // ==========================================================================
  // MODALES INTERACTIVOS: DETALLE, ABONO, ESTADO
  // ==========================================================================
  async verDetalleContrato(id) {
    try {
      const res = await api.get(`/optica/contratos/${id}`);
      if (!res.success || !res.data) throw new Error('No se pudo obtener el detalle');
      const c = res.data;

      const titulo = document.getElementById('modal-optica-detalle-titulo');
      if (titulo) titulo.textContent = `Orden de Trabajo ${c.codigo_contrato}`;

      const body = document.getElementById('modal-optica-detalle-body');
      if (!body) return;

      const saldo = parseFloat(c.saldo_pendiente || 0);

      body.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.25rem">
          <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: var(--border-radius-md)">
            <div class="text-muted" style="font-size: 0.8rem">DATOS DEL CLIENTE</div>
            <div style="font-weight: 700; font-size: 1.05rem; margin-top: 2px">${c.cliente_nombre}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px">
              ${c.cliente_dni_ruc ? `Doc: ${c.cliente_dni_ruc}` : ''}
              ${c.cliente_telefono ? ` · Tel: ${c.cliente_telefono}` : ''}
            </div>
            ${c.cliente_direccion ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px">Dir: ${c.cliente_direccion}</div>` : ''}
          </div>

          <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: var(--border-radius-md)">
            <div class="text-muted" style="font-size: 0.8rem">ESTADO Y SUCURSAL</div>
            <div style="margin-top: 4px; display: flex; gap: 0.5rem; align-items: center">
              ${this.getEstadoTrabajoBadge(c.estado)}
              ${this.getEstadoPagoBadge(c.estado_pago, c.saldo_pendiente)}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px">
              Sucursal: <strong>${c.sucursal_nombre}</strong> · Atendido por: ${c.usuario_nombre}
            </div>
            ${c.venta_numero_comprobante ? `
              <div style="margin-top: 4px; font-size: 0.85rem; color: var(--color-success)">
                <strong>Comprobante Emitido:</strong> ${c.venta_tipo_comprobante?.toUpperCase()} ${c.venta_numero_comprobante}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Receta Oftálmica si tiene -->
        ${c.receta ? `
          <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 0.75rem; margin-bottom: 1rem">
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--accent-gold-dark)">
              Graduación Visual
            </div>
            <table class="data-table" style="font-size: 0.85rem; text-align: center">
              <thead>
                <tr style="background: var(--bg-secondary)">
                  <th>OJO</th>
                  <th>ESF (SPH)</th>
                  <th>CIL (CYL)</th>
                  <th>EJE (°)</th>
                  <th>ADICIÓN (ADD)</th>
                  <th style="color: #1e3a8a">ESF. CERCA (RESULTADO)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: bold; color: #1e3a8a">OD</td>
                  <td>${c.receta.od_esfera !== null && c.receta.od_esfera !== undefined ? (c.receta.od_esfera > 0 ? '+' : '') + c.receta.od_esfera : '—'}</td>
                  <td>${c.receta.od_cilindro !== null && c.receta.od_cilindro !== undefined ? (c.receta.od_cilindro > 0 ? '+' : '') + c.receta.od_cilindro : '—'}</td>
                  <td>${c.receta.od_eje !== null && c.receta.od_eje !== undefined ? `${c.receta.od_eje}°` : '—'}</td>
                  <td style="font-weight: bold; color: var(--accent-gold-dark)">${c.receta.od_adicion ? '+' + c.receta.od_adicion : '—'}</td>
                  <td style="font-weight: 800; color: #1e3a8a">${c.receta.od_esfera_cerca || (c.receta.od_adicion && c.receta.od_esfera ? window.optica.calcularEsferaCerca(c.receta.od_esfera, c.receta.od_adicion) : '—')}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #047857">OI</td>
                  <td>${c.receta.oi_esfera !== null && c.receta.oi_esfera !== undefined ? (c.receta.oi_esfera > 0 ? '+' : '') + c.receta.oi_esfera : '—'}</td>
                  <td>${c.receta.oi_cilindro !== null && c.receta.oi_cilindro !== undefined ? (c.receta.oi_cilindro > 0 ? '+' : '') + c.receta.oi_cilindro : '—'}</td>
                  <td>${c.receta.oi_eje !== null && c.receta.oi_eje !== undefined ? `${c.receta.oi_eje}°` : '—'}</td>
                  <td style="font-weight: bold; color: var(--accent-gold-dark)">${c.receta.oi_adicion ? '+' + c.receta.oi_adicion : '—'}</td>
                  <td style="font-weight: 800; color: #047857">${c.receta.oi_esfera_cerca || (c.receta.oi_adicion && c.receta.oi_esfera ? window.optica.calcularEsferaCerca(c.receta.oi_esfera, c.receta.oi_adicion) : '—')}</td>
                </tr>
              </tbody>
            </table>
            <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); display: flex; gap: 1rem; flex-wrap: wrap">
              <span><strong>Diseño:</strong> ${c.receta.tipo_luna || '—'}</span>
              <span><strong>Material:</strong> ${c.receta.material_luna || '—'}</span>
              <span><strong>Tratamientos:</strong> ${c.receta.tratamientos || 'Ninguno'}</span>
              ${c.receta.indicaciones ? `<span><strong>Indicaciones:</strong> ${c.receta.indicaciones}</span>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Ítems del Contrato -->
        <div style="margin-bottom: 1rem">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem">Detalle de Productos y Servicios</div>
          <table class="data-table" style="font-size: 0.85rem">
            <thead>
              <tr>
                <th>Cant</th>
                <th>Concepto / Producto</th>
                <th>Tipo</th>
                <th class="text-right">Unitario</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(c.items || []).map(it => `
                <tr>
                  <td>${it.cantidad}</td>
                  <td>${it.descripcion}</td>
                  <td><span class="badge" style="font-size:0.75rem">${it.tipo_item}</span></td>
                  <td class="text-right">S/ ${parseFloat(it.precio_unitario).toFixed(2)}</td>
                  <td class="text-right fw-bold">S/ ${parseFloat(it.subtotal_item).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Resumen Financiero y Abonos -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem">
          <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: var(--border-radius-md)">
            <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.5rem">Historial de Pagos y Abonos</div>
            ${(c.pagos || []).length === 0 ? '<div class="text-muted" style="font-size:0.8rem">No se han registrado pagos aún.</div>' : `
              <div style="font-size: 0.8rem">
                ${c.pagos.map(p => `
                  <div class="flex justify-between" style="border-bottom: 1px solid var(--bg-secondary); padding: 3px 0">
                    <span>${this.fmtFecha(p.fecha)} (${p.metodo_pago})</span>
                    <strong class="text-success">S/ ${parseFloat(p.monto).toFixed(2)}</strong>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: var(--border-radius-md); text-align: right">
            <div style="font-size: 0.85rem" class="text-muted">Subtotal: S/ ${parseFloat(c.subtotal).toFixed(2)}</div>
            ${parseFloat(c.descuento) > 0 ? `<div style="font-size: 0.85rem; color: var(--color-danger)">Descuento: - S/ ${parseFloat(c.descuento).toFixed(2)}</div>` : ''}
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-top: 4px">
              Total: S/ ${parseFloat(c.total).toFixed(2)}
            </div>
            <div style="font-size: 0.9rem; color: var(--color-success); margin-top: 2px">
              Abonado: S/ ${parseFloat(c.total_pagado).toFixed(2)}
            </div>
            <div style="font-size: 1.1rem; font-weight: 800; color: ${saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; margin-top: 4px">
              Saldo Restante: S/ ${saldo.toFixed(2)}
            </div>
          </div>
        </div>

        <!-- Historial de Estados de Taller -->
        ${(c.historial_estados || []).length > 0 ? `
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem">Línea de Tiempo / Auditoría de Taller</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary)">
              ${c.historial_estados.map(h => `
                <div style="margin-bottom: 2px">
                  • <strong>${this.fmtFecha(h.fecha)}:</strong> Pasó a <span class="badge" style="font-size:0.7rem">${h.estado_nuevo}</span> por ${h.usuario_nombre}
                  ${h.observaciones ? ` — <em>${h.observaciones}</em>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;

      // Footer con botones de acción
      const footer = document.getElementById('modal-optica-detalle-footer');
      if (footer) {
        footer.innerHTML = `
          <div style="display: flex; gap: 0.5rem">
            <button class="btn btn-secondary" onclick="window.opticaPrintTicket(${c.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:4px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Ticket Térmico
            </button>
            <button class="btn btn-secondary" onclick="window.opticaPdfContrato(${c.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              PDF Orden Trabajo
            </button>
          </div>
          <div style="display: flex; gap: 0.5rem">
            ${saldo > 0 && c.estado !== 'cancelado' ? `
              <button class="btn btn-success" onclick="app.closeModal('modal-optica-detalle'); window.opticaAbonar(${c.id});">
                + Registrar Abono
              </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="app.closeModal('modal-optica-detalle')">Cerrar</button>
          </div>
        `;
      }

      app.openModal('modal-optica-detalle');
    } catch (e) {
      app.showToast(e.message, 'error');
    }
  },

  // Modal Abono
  abrirModalAbono(id) {
    const contrato = this.contratos.find(c => c.id === id);
    if (!contrato) return;

    document.getElementById('abono-contrato-id').value = contrato.id;
    document.getElementById('abono-codigo-lbl').textContent = contrato.codigo_contrato;
    document.getElementById('abono-cliente-lbl').textContent = contrato.cliente_nombre || 'Cliente';
    document.getElementById('abono-total-lbl').textContent = `S/ ${parseFloat(contrato.total).toFixed(2)}`;
    
    const saldo = parseFloat(contrato.saldo_pendiente || 0);
    document.getElementById('abono-saldo-lbl').textContent = `S/ ${saldo.toFixed(2)}`;
    document.getElementById('abono-monto-input').value = saldo.toFixed(2);
    document.getElementById('abono-monto-input').max = saldo;
    document.getElementById('abono-metodo-select').value = 'efectivo';
    document.getElementById('abono-notas-input').value = '';
    document.getElementById('box-abono-mixto')?.classList.add('hidden');

    this.contratoAbonoActual = contrato;
    app.openModal('modal-optica-abono');
  },

  liquidarSaldoCompleto() {
    if (!this.contratoAbonoActual) return;
    const saldo = parseFloat(this.contratoAbonoActual.saldo_pendiente || 0);
    document.getElementById('abono-monto-input').value = saldo.toFixed(2);
  },

  cambiarMetodoAbono() {
    const met = document.getElementById('abono-metodo-select')?.value;
    const box = document.getElementById('box-abono-mixto');
    if (box) box.classList.toggle('hidden', met !== 'mixto');
  },

  async confirmarAbono() {
    const id = document.getElementById('abono-contrato-id')?.value;
    const monto = parseFloat(document.getElementById('abono-monto-input')?.value || 0);
    const metodo = document.getElementById('abono-metodo-select')?.value || 'efectivo';
    const notas = document.getElementById('abono-notas-input')?.value || '';

    if (!monto || monto <= 0) {
      app.showToast('Ingresa un monto válido para el abono', 'error');
      return;
    }

    const payload = {
      monto,
      metodo_pago: metodo,
      notas,
      monto_efectivo: metodo === 'mixto' ? parseFloat(document.getElementById('abono-monto-efectivo')?.value || 0) : null,
      monto_yape: metodo === 'mixto' ? parseFloat(document.getElementById('abono-monto-yape')?.value || 0) : null,
      sucursal_id: localStorage.getItem('activeSucursal') || 1
    };

    try {
      const res = await api.post(`/optica/contratos/${id}/pagos`, payload);
      if (res.success) {
        app.showToast('Abono registrado con éxito en Caja Chica', 'success');
        app.closeModal('modal-optica-abono');
        await this.loadContratos();
        // Preguntar si desea imprimir ticket de abono
        const printConfirm = confirm('¿Deseas imprimir el comprobante / ticket de abono?');
        if (printConfirm) {
          this.imprimirTicketContrato(id);
        }
      }
    } catch (e) {
      app.showToast('Error al abonar: ' + e.message, 'error');
    }
  },

  // Modal Cambiar Estado
  abrirModalEstado(id) {
    const contrato = this.contratos.find(c => c.id === id);
    if (!contrato) return;

    document.getElementById('estado-contrato-id').value = contrato.id;
    document.getElementById('estado-nuevo-select').value = contrato.estado;
    document.getElementById('estado-tecnico-input').value = contrato.responsable_taller || '';
    document.getElementById('estado-notas-input').value = '';

    app.openModal('modal-optica-estado');
  },

  async confirmarCambioEstado() {
    const id = document.getElementById('estado-contrato-id')?.value;
    const estado = document.getElementById('estado-nuevo-select')?.value;
    const responsable_taller = document.getElementById('estado-tecnico-input')?.value;
    const observaciones = document.getElementById('estado-notas-input')?.value;

    try {
      const res = await api.put(`/optica/contratos/${id}/estado`, {
        estado,
        responsable_taller,
        observaciones
      });
      if (res.success) {
        app.showToast('Estado del contrato actualizado correctamente', 'success');
        app.closeModal('modal-optica-estado');
        await this.loadContratos();
      }
    } catch (e) {
      app.showToast('Error cambiando estado: ' + e.message, 'error');
    }
  },

  // Impresión y PDF
  imprimirTicketContrato(id) {
    const token = auth.getToken();
    const url = `${API_URL}/optica/contratos/${id}/ticket?token=${token}`;
    app.printUrl(url);
  },

  imprimirTicketReceta(recetaId) {
    const token = auth.getToken();
    const url = `${API_URL}/optica/recetas/${recetaId}/ticket?token=${token}`;
    app.printUrl(url);
  },

  abrirPdfContrato(id) {
    const token = auth.getToken();
    const url = `${API_URL}/optica/contratos/${id}/pdf?token=${token}`;
    window.open(url, '_blank');
  },

  // Helpers de Formato y Badges
  fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  getTipoServicioBadge(tipo) {
    const map = {
      completo: '<span class="badge" style="background:rgba(59,130,246,0.15);color:#1d4ed8;font-size:0.75rem;font-weight:600">Completo</span>',
      cambio_montura: '<span class="badge" style="background:rgba(201,169,110,0.2);color:var(--accent-gold-dark);font-size:0.75rem;font-weight:600">Cambio Montura</span>',
      reparacion: '<span class="badge" style="background:rgba(245,158,11,0.15);color:#b45309;font-size:0.75rem;font-weight:600">Reparación</span>',
      medicion: '<span class="badge" style="background:rgba(16,185,129,0.15);color:#047857;font-size:0.75rem;font-weight:600">Medición</span>'
    };
    return map[tipo] || `<span class="badge">${tipo}</span>`;
  },

  getEstadoTrabajoBadge(estado) {
    const map = {
      registrado: '<span class="badge" style="background:rgba(148,163,184,0.2);color:#475569">Registrado</span>',
      pendiente_elaboracion: '<span class="badge" style="background:rgba(245,158,11,0.15);color:#b45309">Pend. Taller</span>',
      en_elaboracion: '<span class="badge" style="background:rgba(59,130,246,0.15);color:#1d4ed8">En Taller</span>',
      listo_entrega: '<span class="badge badge-success" style="font-weight:bold">Listo p/ Entrega</span>',
      entregado: '<span class="badge" style="background:rgba(124,58,237,0.15);color:#6d28d9;font-weight:bold">Entregado</span>',
      cancelado: '<span class="badge badge-danger">Cancelado</span>'
    };
    return map[estado] || `<span class="badge">${estado}</span>`;
  },

  getEstadoPagoBadge(estadoPago, saldo) {
    const s = parseFloat(saldo || 0);
    if (estadoPago === 'cancelado' || s <= 0) {
      return '<span class="badge badge-success">Cancelado</span>';
    }
    if (estadoPago === 'parcial') {
      return '<span class="badge badge-warning">Adelanto</span>';
    }
    return '<span class="badge badge-danger">Pendiente</span>';
  }
};
