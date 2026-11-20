import { api, API_URL } from './api.js';
import { auth } from './auth.js';

export const kardexModal = {
  currentProductoId: null,
  currentVarianteId: '',
  currentSucursalId: '',
  kardexData: null,

  async abrir(productoId, varianteId = null) {
    // Protección estricta: Solo para rol Administrador
    if (!auth.isAdmin()) {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Acceso restringido: El Kárdex solo está disponible para el rol Administrador', 'error');
      } else {
        alert('Acceso restringido: Solo disponible para el rol Administrador');
      }
      return;
    }

    this.currentProductoId = productoId;
    this.currentVarianteId = varianteId ? String(varianteId) : '';
    this.currentSucursalId = localStorage.getItem('activeSucursal') || 'todas';

    this.ensureModalExists();

    // Resetear filtros al abrir para evitar estado residual
    const sucursalSelect = document.getElementById('kardex-filtro-sucursal');
    if (sucursalSelect) sucursalSelect.value = this.currentSucursalId;

    const varSelect = document.getElementById('kardex-filtro-variante');
    if (varSelect) {
      varSelect.innerHTML = '<option value="">Todas las variantes</option>';
      varSelect.value = '';
    }

    const tipoSelect = document.getElementById('kardex-filtro-tipo');
    if (tipoSelect) tipoSelect.value = '';

    const desdeInput = document.getElementById('kardex-filtro-desde');
    if (desdeInput) desdeInput.value = '';

    const hastaInput = document.getElementById('kardex-filtro-hasta');
    if (hastaInput) hastaInput.value = '';

    window.app.openModal('modal-kardex-producto');
    await this.cargarDatos(true);
  },

  ensureModalExists() {
    let modalEl = document.getElementById('modal-kardex-producto');
    if (modalEl) {
      modalEl.style.cssText = 'z-index: 10005 !important;';
      return;
    }

    modalEl = document.createElement('div');
    modalEl.id = 'modal-kardex-producto';
    modalEl.className = 'modal-overlay';
    modalEl.style.cssText = 'z-index: 10005 !important;';
    modalEl.innerHTML = `
      <div class="modal" style="max-width: 980px; width: 95%; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="modal-header flex justify-between items-center" style="border-bottom: 1px solid var(--bg-secondary); padding: 1rem 1.25rem;">
          <div class="flex items-center" style="gap: 0.6rem">
            <div style="background: var(--accent-gold-light); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold-dark)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div>
              <div class="flex items-center" style="gap: 0.5rem">
                <h3 class="text-gold" style="margin: 0; font-size: 1.15rem" id="kardex-modal-prod-nombre">Kárdex Físico</h3>
                <span class="badge" style="background: rgba(142, 175, 194, 0.2); color: #0284c7; font-size: 0.75rem" id="kardex-modal-prod-sku">-</span>
                <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #b45309; font-size: 0.75rem; font-weight: bold">Solo Administrador</span>
              </div>
              <small class="text-muted" id="kardex-modal-prod-detalles">Historial de entradas, salidas y existencias físicas</small>
            </div>
          </div>
          <button class="btn-icon btn-secondary" onclick="window.app.closeModal('modal-kardex-producto')">✕</button>
        </div>

        <div class="modal-body" style="padding: 1.25rem; overflow-y: auto; flex: 1;">
          <!-- Barra de Filtros y Sucursal -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; background: var(--bg-primary); padding: 0.85rem; border-radius: var(--border-radius-md); margin-bottom: 1rem; border: 1px solid var(--bg-secondary); align-items: flex-end;">
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.8rem">Sucursal / Tienda</label>
              <select id="kardex-filtro-sucursal" class="form-control" onchange="window.kardexModal.onFiltroChange()">
                <option value="todas">🌐 Vista Consolidada (Todas)</option>
              </select>
            </div>
            <div class="form-group mb-0" id="kardex-container-filtro-variante" style="display: none;">
              <label class="form-label" style="font-size: 0.8rem">Subproducto / Variante</label>
              <select id="kardex-filtro-variante" class="form-control" onchange="window.kardexModal.onFiltroChange()">
                <option value="">Todas las variantes</option>
              </select>
            </div>
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.8rem">Tipo Operación</label>
              <select id="kardex-filtro-tipo" class="form-control" onchange="window.kardexModal.onFiltroChange()">
                <option value="">Todos los movimientos</option>
                <option value="VENTA">🛒 Ventas POS</option>
                <option value="ANULACION_VENTA">❌ Anulaciones</option>
                <option value="AJUSTE_POSITIVO">➕ Ajustes Positivos (+)</option>
                <option value="AJUSTE_NEGATIVO">➖ Ajustes Negativos (-)</option>
                <option value="OPTICA_RESERVA">👓 Órdenes Óptica</option>
                <option value="TRASLADO_SALIDA">📤 Traslados Despachados</option>
                <option value="TRASLADO_ENTRADA">📥 Traslados Recibidos</option>
              </select>
            </div>
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.8rem">Desde</label>
              <input type="date" id="kardex-filtro-desde" class="form-control" onchange="window.kardexModal.onFiltroChange()">
            </div>
            <div class="form-group mb-0">
              <label class="form-label" style="font-size: 0.8rem">Hasta</label>
              <input type="date" id="kardex-filtro-hasta" class="form-control" onchange="window.kardexModal.onFiltroChange()">
            </div>
          </div>

          <!-- Métricas Resumen -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 0.75rem; border-left: 4px solid var(--accent-gold);">
              <div class="text-muted" style="font-size: 0.75rem; font-weight: 600">STOCK ACTUAL TOTAL</div>
              <div id="kardex-stat-stock" class="text-gold" style="font-size: 1.4rem; font-weight: 800">0</div>
              <small class="text-muted" id="kardex-stat-stock-sub">En inventario</small>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 0.75rem; border-left: 4px solid #10b981;">
              <div class="text-muted" style="font-size: 0.75rem; font-weight: 600">TOTAL ENTRADAS (+)</div>
              <div id="kardex-stat-entradas" style="font-size: 1.4rem; font-weight: 800; color: #10b981">0</div>
              <small class="text-muted">Ajustes +, reingresos</small>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 0.75rem; border-left: 4px solid var(--color-danger);">
              <div class="text-muted" style="font-size: 0.75rem; font-weight: 600">TOTAL SALIDAS (-)</div>
              <div id="kardex-stat-salidas" style="font-size: 1.4rem; font-weight: 800; color: var(--color-danger)">0</div>
              <small class="text-muted">Ventas, traslados, mermas</small>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); padding: 0.75rem; border-left: 4px solid #3b82f6;">
              <div class="text-muted" style="font-size: 0.75rem; font-weight: 600">AUDITORÍA AJUSTES</div>
              <div id="kardex-stat-ajustes" style="font-size: 1.4rem; font-weight: 800; color: #3b82f6">0</div>
              <small class="text-muted">Modificaciones manuales</small>
            </div>
          </div>

          <!-- Tabla de Movimientos del Kárdex -->
          <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
            <table class="data-table" id="tabla-kardex-movimientos" style="font-size: 0.85rem">
              <thead>
                <tr style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 10;">
                  <th>Fecha y Hora</th>
                  <th>Operación</th>
                  <th>Documento / Ref.</th>
                  <th>Tienda</th>
                  <th>Usuario</th>
                  <th class="text-right" style="color: #10b981">Entrada (+)</th>
                  <th class="text-right" style="color: var(--color-danger)">Salida (-)</th>
                  <th class="text-right fw-bold">Saldo</th>
                  <th>Motivo / Observación</th>
                </tr>
              </thead>
              <tbody id="tbody-kardex-movimientos">
                <tr><td colspan="9" class="text-center text-muted" style="padding: 2rem">Cargando kárdex...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer flex justify-between items-center" style="border-top: 1px solid var(--bg-secondary); padding: 0.75rem 1.25rem;">
          <button class="btn btn-secondary flex items-center gap-1" onclick="window.kardexModal.exportarExcel()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Exportar Kárdex (Excel)
          </button>
          <button class="btn btn-primary" onclick="window.app.closeModal('modal-kardex-producto')">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  },

  async cargarDatos(isInit = false) {
    try {
      const tbody = document.getElementById('tbody-kardex-movimientos');
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 2rem">Cargando historial del producto...</td></tr>`;

      const params = {};
      const sucursalVal = document.getElementById('kardex-filtro-sucursal')?.value || this.currentSucursalId;
      params.sucursal_id = (sucursalVal && sucursalVal !== 'todas') ? sucursalVal : null;

      // Usar variante específica si fue pasada o seleccionada
      let varianteVal = '';
      if (isInit) {
        varianteVal = this.currentVarianteId || '';
      } else {
        const sel = document.getElementById('kardex-filtro-variante');
        varianteVal = sel ? sel.value : (this.currentVarianteId || '');
      }
      if (varianteVal) params.variante_id = varianteVal;

      const tipoVal = document.getElementById('kardex-filtro-tipo')?.value;
      if (tipoVal) params.tipo_movimiento = tipoVal;

      const desdeVal = document.getElementById('kardex-filtro-desde')?.value;
      if (desdeVal) params.fecha_inicio = desdeVal;

      const hastaVal = document.getElementById('kardex-filtro-hasta')?.value;
      if (hastaVal) params.fecha_fin = hastaVal;

      const res = await api.get(`/kardex/producto/${this.currentProductoId}`, params);
      if (!res.success || !res.data) throw new Error(res.message || 'No se pudo cargar el kárdex');

      this.kardexData = res.data;
      this.renderUI();
    } catch (err) {
      const errMsg = err.message || 'Error desconocido';
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Error cargando Kárdex: ' + errMsg, 'error');
      }
      const tbody = document.getElementById('tbody-kardex-movimientos');
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger" style="padding: 2rem">${errMsg}</td></tr>`;
    }
  },

  renderUI() {
    const { producto, variantes, variante_seleccionada_id, stock_sucursales, resumen, movimientos } = this.kardexData;

    // Actualizar ID de variante activa
    if (variante_seleccionada_id) {
      this.currentVarianteId = String(variante_seleccionada_id);
    }

    // Encabezado
    const nombreEl = document.getElementById('kardex-modal-prod-nombre');
    const skuEl = document.getElementById('kardex-modal-prod-sku');
    const detEl = document.getElementById('kardex-modal-prod-detalles');

    let currentVarObj = null;
    if (this.currentVarianteId && variantes && variantes.length > 0) {
      currentVarObj = variantes.find(v => String(v.id) === String(this.currentVarianteId));
    }

    if (nombreEl) {
      if (currentVarObj) {
        nombreEl.textContent = `${producto.nombre} · ${currentVarObj.nombre_variante}`;
      } else {
        nombreEl.textContent = producto.nombre;
      }
    }

    if (skuEl) {
      if (currentVarObj) {
        skuEl.textContent = currentVarObj.sku || `VAR-${currentVarObj.id}`;
      } else {
        skuEl.textContent = producto.codigo || `ID-${producto.id}`;
      }
    }

    if (detEl) {
      const precioVenta = currentVarObj && currentVarObj.precio_venta ? currentVarObj.precio_venta : producto.precio_venta;
      detEl.textContent = `Categoría: ${producto.categoria_nombre || '—'} · Material: ${producto.material_nombre || '—'} · Precio Venta: S/ ${parseFloat(precioVenta).toFixed(2)}`;
    }

    // Poblar Selector de Sucursales
    const sucursalSelect = document.getElementById('kardex-filtro-sucursal');
    if (sucursalSelect) {
      // Re-poblar opciones manteniendo la selección
      const currentSelectedSuc = sucursalSelect.value || this.currentSucursalId || 'todas';
      sucursalSelect.innerHTML = '<option value="todas">🌐 Vista Consolidada (Todas)</option>';
      (stock_sucursales || []).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.sucursal_id;
        opt.textContent = `🏪 ${s.sucursal_nombre} (Stock: ${s.stock_actual})`;
        sucursalSelect.appendChild(opt);
      });
      sucursalSelect.value = currentSelectedSuc;
    }

    // Poblar Selector de Variantes / Subproductos si tiene
    const varContainer = document.getElementById('kardex-container-filtro-variante');
    const varSelect = document.getElementById('kardex-filtro-variante');
    if (producto.tiene_variantes && (variantes || []).length > 0) {
      varContainer.style.display = 'block';
      const prevVal = this.currentVarianteId || varSelect.value || '';
      varSelect.innerHTML = '<option value="">Todas las variantes</option>';
      variantes.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.nombre_variante} (${v.sku || '-'})`;
        varSelect.appendChild(opt);
      });
      if (prevVal) varSelect.value = String(prevVal);
    } else {
      varContainer.style.display = 'none';
    }

    // Métricas Resumen
    document.getElementById('kardex-stat-stock').textContent = resumen.stock_actual_total;
    const stockSub = document.getElementById('kardex-stat-stock-sub');
    if (stockSub && stock_sucursales && stock_sucursales.length > 0) {
      stockSub.innerHTML = stock_sucursales.map(s => `${s.sucursal_nombre}: <b>${s.stock_actual}</b>`).join(' · ');
    }
    document.getElementById('kardex-stat-entradas').textContent = resumen.total_entradas;
    document.getElementById('kardex-stat-salidas').textContent = resumen.total_salidas;
    document.getElementById('kardex-stat-ajustes').textContent = resumen.total_ajustes;

    // Render Tabla de Movimientos
    const tbody = document.getElementById('tbody-kardex-movimientos');
    if (!tbody) return;

    if (!movimientos || movimientos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 2.5rem">No se encontraron movimientos registrados para este producto o variante con los filtros aplicados.</td></tr>`;
      return;
    }

    tbody.innerHTML = movimientos.map(m => {
      const fechaStr = this.fmtFecha(m.fecha);
      const badgeOperacion = this.getBadgeOperacion(m.tipo_movimiento);
      const entrada = parseInt(m.cantidad_entrada || 0, 10);
      const salida = parseInt(m.cantidad_salida || 0, 10);
      const saldo = m.stock_saldo !== null && m.stock_saldo !== undefined ? m.stock_saldo : '—';
      const docRef = m.documento_referencia || m.tipo_documento || '—';
      const varianteBadge = m.nombre_variante ? `<br><small class="text-gold" style="font-size:0.75rem">${m.nombre_variante}</small>` : '';
      const userDisplay = m.usuario_nombre 
        ? `${m.usuario_nombre}${m.usuario_username ? `<br><small class="text-muted" style="font-size:0.75rem">@${m.usuario_username}</small>` : ''}` 
        : '<small class="text-muted">Sistema</small>';
      const detalleTexto = m.detalle_operacion || m.motivo || m.notas || '—';

      return `
        <tr>
          <td style="white-space: nowrap;"><small class="text-muted">${fechaStr}</small></td>
          <td>${badgeOperacion}${varianteBadge}</td>
          <td><strong style="font-family: monospace; font-size: 0.85rem">${docRef}</strong></td>
          <td><span class="badge" style="font-size: 0.72rem">${m.sucursal_nombre || 'Principal'}</span></td>
          <td>${userDisplay}</td>
          <td class="text-right" style="color: #10b981; font-weight: 700">${entrada > 0 ? `+${entrada}` : '—'}</td>
          <td class="text-right" style="color: var(--color-danger); font-weight: 700">${salida > 0 ? `-${salida}` : '—'}</td>
          <td class="text-right fw-bold" style="font-size: 0.95rem; color: var(--text-primary); background: rgba(201,169,110,0.06);">${saldo}</td>
          <td style="font-size: 0.82rem; color: var(--text-secondary); max-width: 280px; line-height: 1.3;" title="${detalleTexto}">
            ${detalleTexto}
          </td>
        </tr>
      `;
    }).join('');
  },

  onFiltroChange() {
    const sel = document.getElementById('kardex-filtro-variante');
    if (sel) this.currentVarianteId = sel.value;
    this.cargarDatos(false);
  },

  exportarExcel() {
    const token = auth.getToken();
    const sucursalVal = document.getElementById('kardex-filtro-sucursal')?.value || '';
    const varianteVal = document.getElementById('kardex-filtro-variante')?.value || this.currentVarianteId || '';
    const url = `${API_URL}/kardex/producto/${this.currentProductoId}/exportar?token=${token}&sucursal_id=${sucursalVal}&variante_id=${varianteVal}`;
    window.open(url, '_blank');
  },

  fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  getBadgeOperacion(tipo) {
    const map = {
      VENTA: '<span class="badge" style="background:rgba(59,130,246,0.15);color:#1d4ed8;font-size:0.75rem;font-weight:600">🛒 Venta POS</span>',
      ANULACION_VENTA: '<span class="badge" style="background:rgba(239,68,68,0.15);color:#b91c1c;font-size:0.75rem;font-weight:600">❌ Anulación</span>',
      AJUSTE_POSITIVO: '<span class="badge" style="background:rgba(16,185,129,0.15);color:#047857;font-size:0.75rem;font-weight:600">➕ Ajuste (+)</span>',
      AJUSTE_NEGATIVO: '<span class="badge" style="background:rgba(245,158,11,0.15);color:#b45309;font-size:0.75rem;font-weight:600">➖ Ajuste (-)</span>',
      OPTICA_RESERVA: '<span class="badge" style="background:rgba(201,169,110,0.2);color:var(--accent-gold-dark);font-size:0.75rem;font-weight:600">👓 Órden Óptica</span>',
      OPTICA_CANCELACION: '<span class="badge" style="background:rgba(148,163,184,0.2);color:#475569;font-size:0.75rem;font-weight:600">Cancelación Óptica</span>',
      TRASLADO_SALIDA: '<span class="badge" style="background:rgba(249,115,22,0.15);color:#c2410c;font-size:0.75rem;font-weight:600">📤 Traslado Envío</span>',
      TRASLADO_ENTRADA: '<span class="badge" style="background:rgba(16,185,129,0.15);color:#047857;font-size:0.75rem;font-weight:600">📥 Traslado Recibido</span>',
      INVENTARIO_INICIAL: '<span class="badge" style="background:rgba(107,114,128,0.15);color:#374151;font-size:0.75rem;font-weight:600">📦 Saldo Inicial</span>'
    };
    return map[tipo] || `<span class="badge">${tipo}</span>`;
  }
};

window.kardexModal = kardexModal;
window.abrirKardexProducto = (prodId, varId) => kardexModal.abrir(prodId, varId);
