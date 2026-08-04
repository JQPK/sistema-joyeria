import { api } from '../api.js';
import { scanner } from '../scanner.js';

export default {
  container: null,
  _currentProd: null,     // producto completo del último escaneo
  _currentVariant: null,  // variante del último escaneo (o null)

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="flex-col gap-4">
        <h2 class="text-gold" style="margin-bottom: 1rem">Estado del Inventario</h2>
        
        <div class="stats-grid">
          <div class="card stat-card" style="border-left: 4px solid var(--color-info)">
            <div class="stat-icon" style="background: rgba(142, 175, 194, 0.1); color: var(--color-info)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Productos Activos</div>
              <div class="fw-bold text-info" style="font-size: 1.5rem" id="inv-total-prod">0</div>
            </div>
          </div>
          
          <div class="card stat-card" style="border-left: 4px solid var(--accent-gold)">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Total Unidades</div>
              <div class="fw-bold text-gold" style="font-size: 1.5rem" id="inv-total-unidades">0</div>
            </div>
          </div>

          <div class="card stat-card" style="border-left: 4px solid var(--color-success)">
            <div class="stat-icon" style="background: rgba(129, 178, 154, 0.1); color: var(--color-success)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Valor Venta (S/)</div>
              <div class="fw-bold text-success" style="font-size: 1.5rem" id="inv-valor-venta">0.00</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 1rem">
          <div class="card">
            <div class="card-header">
              <h3 style="font-size: 1.1rem">Top 10 Más Vendidos</h3>
            </div>
            <div class="card-body" style="padding: 0">
              <div class="table-responsive">
                <table class="data-table" id="inv-top-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock Actual</th>
                      <th class="text-right">Vendidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colspan="3" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 style="font-size: 1.1rem">Top 10 Menos Rotación (Últ. 90 días)</h3>
            </div>
            <div class="card-body" style="padding: 0">
              <div class="table-responsive">
                <table class="data-table" id="inv-low-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Stock Actual</th>
                      <th class="text-right">Vendidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td colspan="3" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem">
          <div class="card-header flex justify-between items-center flex-wrap gap-2">
            <h3 style="font-size: 1.1rem">Detalle de Inventario</h3>
            <div class="mobile-filter-row">
              <div class="form-control flex items-center" style="padding:0; min-width:0">
                <input type="text" id="inv-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar producto...">
              </div>
              <button class="btn btn-secondary btn-sm flex items-center gap-2" onclick="window.invScan()" title="Escanear código de barras">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 1 2 2h4M21 9V5a2 2 0 0 1-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4M7 12h10"></path></svg>
                Escanear
              </button>
              <button class="btn btn-secondary btn-sm flex items-center gap-2" onclick="window.invExportExcel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Exportar
              </button>
            </div>
          </div>
          <div class="card-body" style="padding: 0">
            <div class="table-responsive">
              <table class="data-table" id="inv-full-table">
                <thead>
                  <tr>
                    <th>Código/SKU</th>
                    <th>Producto/Variante</th>
                    <th>Categoría</th>
                    <th>Material</th>
                    <th>Stock Actual</th>
                    <th>Precio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    `;

    this._crearModal();
    await this.loadData();
  },

  // Crea el modal en document.body para que position:fixed funcione sobre el viewport real
  _crearModal() {
    // Quitar si ya existe (por si se navega de ida y vuelta)
    const viejo = document.getElementById('inv-scan-modal');
    if (viejo) viejo.remove();

    const modal = document.createElement('div');
    modal.id = 'inv-scan-modal';
    modal.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:9999',
      'background:rgba(0,0,0,.72)',
      'align-items:center',
      'justify-content:center',
      'padding:1rem'
    ].join(';');
    modal.innerHTML = `
      <div style="background:var(--bg-card); border-radius:16px; width:100%; max-width:480px;
                  max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,.6);">
        <div style="padding:1.25rem 1.25rem .5rem; display:flex; justify-content:space-between;
                    align-items:center; border-bottom:1px solid var(--border)">
          <h3 style="font-size:1.05rem; font-weight:700; color:var(--text-primary);
                     display:flex; gap:.5rem; align-items:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18">
              <path d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 1 2 2h4M21 9V5a2 2 0 0 1-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4M7 12h10"></path>
            </svg>
            Detalle del Producto
          </h3>
          <button onclick="window.invCloseModal()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.5rem;line-height:1">&times;</button>
        </div>
        <div id="inv-scan-content" style="padding:1.25rem">
          <div class="text-center text-muted" style="padding:2rem">Buscando producto...</div>
        </div>
        <div style="padding:.75rem 1.25rem 1.25rem; display:flex; gap:.5rem; justify-content:flex-end; flex-wrap:wrap">
          <button class="btn btn-secondary" onclick="window.invScan()">📷 Escanear otro</button>
          <button class="btn btn-secondary" onclick="window.invImprimirEtiqueta()" id="inv-btn-print"
                  style="background:rgba(96,165,250,.12);color:#3b82f6;border:1px solid rgba(96,165,250,.35);display:none">
            🖨️ Imprimir
          </button>
          <button class="btn btn-warning" onclick="window.invAbrirEdicion()" id="inv-btn-editar"
                  style="background:rgba(251,191,36,.15);color:#d97706;border:1px solid rgba(251,191,36,.4);display:none">
            ✏️ Actualizar
          </button>
          <button class="btn btn-primary" onclick="window.invCloseModal()">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // ── Modal de edición del producto ──────────────────────────────────────────
    const viejo2 = document.getElementById('inv-edit-modal');
    if (viejo2) viejo2.remove();

    const editModal = document.createElement('div');
    editModal.id = 'inv-edit-modal';
    editModal.style.cssText = [
      'display:none',
      'position:fixed',
      'inset:0',
      'z-index:10000',
      'background:rgba(0,0,0,.82)',
      'align-items:center',
      'justify-content:center',
      'padding:1rem'
    ].join(';');
    editModal.innerHTML = `
      <div style="background:var(--bg-card); border-radius:16px; width:100%; max-width:420px;
                  max-height:90vh; overflow-y:auto; box-shadow:0 24px 64px rgba(0,0,0,.7);">
        <div style="padding:1.25rem 1.25rem .5rem; display:flex; justify-content:space-between;
                    align-items:center; border-bottom:1px solid var(--border)">
          <h3 style="font-size:1.05rem; font-weight:700; color:var(--text-primary);
                     display:flex; gap:.5rem; align-items:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Actualizar Producto
          </h3>
          <button onclick="window.invCloseEditModal()"
                  style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.5rem;line-height:1">&times;</button>
        </div>
        <div style="padding:1.25rem; display:flex; flex-direction:column; gap:.9rem">
          <div>
            <label style="font-size:.8rem; color:var(--text-muted); display:block; margin-bottom:.3rem">Nombre del Producto</label>
            <input id="inv-edit-nombre" type="text" class="form-control" style="width:100%" placeholder="Nombre">
          </div>
          <div>
            <label style="font-size:.8rem; color:var(--text-muted); display:block; margin-bottom:.3rem">Descripción</label>
            <textarea id="inv-edit-descripcion" class="form-control" rows="2" style="width:100%;resize:vertical" placeholder="Descripción opcional"></textarea>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:.75rem">
            <div>
              <label style="font-size:.8rem; color:var(--text-muted); display:block; margin-bottom:.3rem">Precio de Venta (S/)</label>
              <input id="inv-edit-precio" type="number" step="0.01" min="0" class="form-control" style="width:100%" placeholder="0.00">
            </div>
            <div>
              <label style="font-size:.8rem; color:var(--text-muted); display:block; margin-bottom:.3rem">Stock Actual</label>
              <input id="inv-edit-stock" type="number" min="0" class="form-control" style="width:100%" placeholder="0">
            </div>
          </div>
        </div>
        <div style="padding:.75rem 1.25rem 1.25rem; display:flex; gap:.5rem; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="window.invCloseEditModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="window.invGuardarEdicion()">
            💾 Guardar cambios
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(editModal);
  },

  async loadData() {
    try {
      // Load Stats
      const statsRes = await api.get('/inventario/stats');
      if (statsRes.success) {
        document.getElementById('inv-total-prod').textContent = statsRes.data.total_productos;
        document.getElementById('inv-total-unidades').textContent = statsRes.data.total_unidades;
        document.getElementById('inv-valor-venta').textContent = `S/ ${parseFloat(statsRes.data.valor_venta).toFixed(2)}`;
      }

      // Load Top Selling
      const topRes = await api.get('/inventario/top-selling', { limit: 10 });
      if (topRes.success) {
        const tbody = document.querySelector('#inv-top-table tbody');
        if (topRes.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay datos suficientes</td></tr>';
        } else {
          tbody.innerHTML = topRes.data.map(p => `
            <tr>
              <td>
                <div class="fw-bold">${p.nombre}</div>
                <div class="text-muted" style="font-size:0.8rem">${p.codigo || '-'}</div>
              </td>
              <td>${p.stock_actual}</td>
              <td class="text-right fw-bold text-success">${p.total_vendido}</td>
            </tr>
          `).join('');
        }
      }

      // Load Low Rotation
      const lowRes = await api.get('/inventario/low-rotation', { limit: 10, days: 90 });
      if (lowRes.success) {
        const tbody = document.querySelector('#inv-low-table tbody');
        if (lowRes.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay datos suficientes</td></tr>';
        } else {
          tbody.innerHTML = lowRes.data.map(p => `
            <tr>
              <td>
                <div class="fw-bold">${p.nombre}</div>
                <div class="text-muted" style="font-size:0.8rem">${p.codigo || '-'}</div>
              </td>
              <td>${p.stock_actual}</td>
              <td class="text-right fw-bold text-danger">${p.total_vendido}</td>
            </tr>
          `).join('');
        }
      }

      // Load Full Inventory List
      const fullRes = await api.get('/productos', { estado: 'activo' });
      if (fullRes.success) {
        this.productos = fullRes.data;
        this.renderFullTable(this.productos);
      }

    } catch (err) {
      app.showToast('Error cargando datos de inventario', 'error');
    }
  },

  renderFullTable(data) {
    const tbody = document.querySelector('#inv-full-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay productos en inventario</td></tr>';
      return;
    }

    let html = '';
    data.forEach(p => {
      const isVariants = p.tiene_variantes && p.variantes && p.variantes.length > 0;
      
      if (isVariants) {
        // Render each variant as its own row
        p.variantes.forEach(v => {
          html += `
            <tr>
              <td>${v.sku}</td>
              <td>${p.nombre} - ${v.nombre_variante}</td>
              <td>${p.categoria_nombre || '-'}</td>
              <td>${p.material_nombre || '-'}</td>
              <td>${v.stock_actual}</td>
              <td>S/ ${parseFloat(v.precio_venta || p.precio_venta).toFixed(2)}</td>
            </tr>
          `;
        });
      } else {
        html += `
          <tr>
            <td>${p.codigo || '-'}</td>
            <td>${p.nombre}</td>
            <td>${p.categoria_nombre || '-'}</td>
            <td>${p.material_nombre || '-'}</td>
            <td>${p.stock_actual}</td>
            <td>S/ ${parseFloat(p.precio_venta).toFixed(2)}</td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = html;
  },

  bindEvents() {
    const search = document.getElementById('inv-search');
    if (search) {
      search.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        if (!this.productos) return;
        const filtered = this.productos.filter(p => {
          const matchP = p.nombre.toLowerCase().includes(term) || (p.codigo && p.codigo.toLowerCase().includes(term));
          let matchV = false;
          if (p.tiene_variantes && p.variantes) {
            matchV = p.variantes.some(v => v.sku.toLowerCase().includes(term) || v.nombre_variante.toLowerCase().includes(term));
          }
          return matchP || matchV;
        });
        this.renderFullTable(filtered);
      });
    }
  },

  exportExcel() {
    if (!this.productos || this.productos.length === 0) {
      return app.showToast('No hay datos de inventario para exportar', 'warning');
    }

    const data = [];
    this.productos.forEach(p => {
      if (p.tiene_variantes && p.variantes) {
        p.variantes.forEach(v => {
          data.push({
            'Código Padre': p.codigo || '-',
            'Producto': p.nombre,
            'SKU Variante': v.sku,
            'Variante': v.nombre_variante,
            'Categoría': p.categoria_nombre || '-',
            'Material': p.material_nombre || '-',
            'Stock': v.stock_actual,
            'Stock Mínimo': v.stock_minimo,
            'Precio Venta (S/)': parseFloat(v.precio_venta || p.precio_venta).toFixed(2)
          });
        });
      } else {
        data.push({
          'Código Padre': p.codigo || '-',
          'Producto': p.nombre,
          'SKU Variante': '-',
          'Variante': '-',
          'Categoría': p.categoria_nombre || '-',
          'Material': p.material_nombre || '-',
          'Stock': p.stock_actual,
          'Stock Mínimo': p.stock_minimo,
          'Precio Venta (S/)': parseFloat(p.precio_venta).toFixed(2)
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Reporte_Inventario_${dateStr}.xlsx`);
  },

  async scanProducto() {
    // Cerrar el modal primero (si estaba abierto por un escaneo previo)
    const modal = document.getElementById('inv-scan-modal');
    if (modal) modal.style.display = 'none';

    await scanner.open(async (codigo) => {
      this.showScanModal();
      try {
        const res = await api.get(`/productos/sku/${encodeURIComponent(codigo)}`);
        if (!res.success) {
          this.renderScanError(codigo);
          return;
        }

        // Fetch full product details
        const prodRes = await api.get(`/productos/${res.data.id}`);
        if (prodRes.success) {
          this.renderScanResult(prodRes.data, res.type === 'variant' ? res.data : null);
        } else {
          this.renderScanError(codigo);
        }
      } catch(err) {
        this.renderScanError(codigo);
      }
    });
  },

  showScanModal() {
    const modal = document.getElementById('inv-scan-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.getElementById('inv-scan-content').innerHTML =
        '<div class="text-center text-muted" style="padding:2rem">Buscando producto...</div>';
    }
  },

  renderScanError(codigo) {
    document.getElementById('inv-scan-content').innerHTML = `
      <div style="text-align:center; padding:1.5rem">
        <div style="font-size:2.5rem; margin-bottom:.5rem">❌</div>
        <div style="font-weight:700; color:var(--color-danger)">Producto no encontrado</div>
        <div style="color:var(--text-muted); font-size:.85rem; margin-top:.5rem; font-family:monospace">${codigo}</div>
      </div>
    `;
  },

  renderScanResult(prod, variantData) {
    this._currentProd    = prod;
    this._currentVariant = variantData || null;

    // Mostrar botones de edición e impresión
    const btnEditar = document.getElementById('inv-btn-editar');
    const btnPrint  = document.getElementById('inv-btn-print');
    if (btnEditar) btnEditar.style.display = 'inline-flex';
    if (btnPrint)  btnPrint.style.display  = 'inline-flex';

    const stockActual = variantData ? variantData.stock_actual : prod.stock_actual;
    const stockMin    = prod.stock_minimo || 1;
    const precio      = variantData ? (variantData.precio_venta || prod.precio_venta) : prod.precio_venta;
    const sku         = variantData ? variantData.codigo : prod.codigo;
    const nombre      = variantData ? variantData.nombre : prod.nombre;

    const stockPct   = Math.min(100, Math.round((stockActual / Math.max(stockMin * 3, 1)) * 100));
    let stockColor   = '#4ade80';  // verde
    let stockLabel   = 'Disponible';
    if (stockActual <= 0)           { stockColor = '#f87171'; stockLabel = 'Sin stock'; }
    else if (stockActual <= stockMin) { stockColor = '#fbbf24'; stockLabel = 'Stock bajo'; }

    document.getElementById('inv-scan-content').innerHTML = `
      <!-- Nombre y SKU -->
      <div style="margin-bottom:1rem">
        <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary); line-height:1.3">${nombre}</div>
        <div style="font-size:.8rem; color:var(--text-muted); font-family:monospace; margin-top:.2rem">${sku || '-'}</div>
      </div>

      <!-- Barra de stock -->
      <div style="background:var(--bg-secondary); border-radius:12px; padding:1rem; margin-bottom:1rem">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem">
          <span style="font-size:.85rem; color:var(--text-muted)">Stock actual</span>
          <span style="font-weight:700; font-size:1.4rem; color:${stockColor}">${stockActual}
            <span style="font-size:.75rem; font-weight:400; opacity:.8">${stockLabel}</span>
          </span>
        </div>
        <div style="height:8px; background:var(--border); border-radius:4px; overflow:hidden">
          <div style="height:100%; width:${stockPct}%; background:${stockColor}; border-radius:4px; transition:width .4s"></div>
        </div>
        <div style="font-size:.75rem; color:var(--text-muted); margin-top:.35rem">Mínimo requerido: ${stockMin} unidades</div>
      </div>

      <!-- Ficha de detalles -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:.5rem">
        ${this._detCard('💰 Precio Venta', `S/ ${parseFloat(precio).toFixed(2)}`)}
        ${this._detCard('📦 Precio Compra', prod.precio_compra > 0 ? `S/ ${parseFloat(prod.precio_compra).toFixed(2)}` : '—')}
        ${this._detCard('🏷️ Categoría', prod.categoria_nombre || '—')}
        ${this._detCard('⚗️ Material', prod.material_nombre || '—')}
        ${this._detCard('⚖️ Peso', prod.peso_gramos > 0 ? `${prod.peso_gramos} gr` : '—')}
        ${this._detCard('📉 Descuento', prod.descuento_porcentaje > 0 ? `${prod.descuento_porcentaje}%` : 'Sin descuento')}
        ${prod.tiene_variantes ? this._detCard('🔀 Variantes', prod.variantes ? prod.variantes.length + ' variantes' : '—') : ''}
      </div>

      ${prod.descripcion ? `<div style="margin-top:.75rem; padding:.75rem; background:var(--bg-secondary); border-radius:8px; font-size:.82rem; color:var(--text-muted)">${prod.descripcion}</div>` : ''}
    `;
  },

  _detCard(label, value) {
    return `
      <div style="background:var(--bg-secondary); border-radius:8px; padding:.6rem .75rem">
        <div style="font-size:.72rem; color:var(--text-muted); margin-bottom:.15rem">${label}</div>
        <div style="font-weight:600; font-size:.9rem; color:var(--text-primary)">${value}</div>
      </div>
    `;
  },

  abrirEdicion() {
    const prod    = this._currentProd;
    const variant = this._currentVariant;
    if (!prod) return;

    // Rellenar campos del modal de edición
    document.getElementById('inv-edit-nombre').value      = prod.nombre || '';
    document.getElementById('inv-edit-descripcion').value = prod.descripcion || '';
    document.getElementById('inv-edit-precio').value      = variant
      ? parseFloat(variant.precio_venta || prod.precio_venta || 0).toFixed(2)
      : parseFloat(prod.precio_venta || 0).toFixed(2);
    document.getElementById('inv-edit-stock').value       = variant
      ? (variant.stock_actual ?? 0)
      : (prod.stock_actual ?? 0);

    // Abrir modal de edición
    const em = document.getElementById('inv-edit-modal');
    if (em) em.style.display = 'flex';
  },

  async guardarEdicion() {
    const prod    = this._currentProd;
    const variant = this._currentVariant;
    if (!prod) return;

    const nombre      = document.getElementById('inv-edit-nombre').value.trim();
    const descripcion = document.getElementById('inv-edit-descripcion').value.trim();
    const precio      = parseFloat(document.getElementById('inv-edit-precio').value);
    const stock       = parseInt(document.getElementById('inv-edit-stock').value, 10);

    if (!nombre)       return app.showToast('El nombre no puede estar vacío', 'error');
    if (isNaN(precio)) return app.showToast('Precio inválido', 'error');
    if (isNaN(stock))  return app.showToast('Stock inválido', 'error');

    try {
      // Actualizar siempre el producto base (nombre, descripción, precio si no hay variante)
      const prodPayload = { nombre, descripcion };
      if (!variant) {
        prodPayload.precio_venta = precio;
        prodPayload.stock_actual = stock;
      }
      await api.put(`/productos/${prod.id}`, prodPayload);

      // Si hay variante, actualizar el precio y stock de la variante específica
      if (variant) {
        await api.put(`/variantes/${variant.id}`, {
          precio_venta: precio,
          stock_actual: stock
        });
      }

      app.showToast('Producto actualizado correctamente', 'success');

      // Cerrar modal de edición
      const em = document.getElementById('inv-edit-modal');
      if (em) em.style.display = 'none';

      // Refrescar datos del scan modal con info actualizada
      const prodRes = await api.get(`/productos/${prod.id}`);
      if (prodRes.success) {
        let updatedVariant = null;
        if (variant && prodRes.data.variantes) {
          updatedVariant = prodRes.data.variantes.find(v => v.id === variant.id) || null;
        }
        this.renderScanResult(prodRes.data, updatedVariant);
      }

      // Refrescar tabla general
      this.loadData();
    } catch (err) {
      app.showToast('Error al actualizar: ' + (err.message || 'Error desconocido'), 'error');
    }
  },

  imprimirEtiqueta() {
    const prod    = this._currentProd;
    const variant = this._currentVariant;
    if (!prod) return;

    const codigo  = variant ? (variant.sku || variant.codigo || prod.codigo) : (prod.codigo || '');
    const nombre  = variant ? `${prod.nombre} — ${variant.nombre_variante}` : prod.nombre;
    const precio  = variant
      ? parseFloat(variant.precio_venta || prod.precio_venta || 0)
      : parseFloat(prod.precio_venta || 0);

    if (!codigo) return app.showToast('Este producto no tiene código de barras', 'warning');

    const jsbUrl = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta — ${nombre}</title>
  <script src="${jsbUrl}"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: Arial, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; padding: 8mm; }
    .wrap {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3mm;
      width: 100%;
    }
    .lbl {
      border: 0.4pt solid #ccc;
      border-radius: 2mm;
      padding: 1.5mm;
      text-align: center;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .lbl canvas { width: 100%; display: block; }
    .nom { font-size: 6pt; color: #333; margin-top: 0.5mm; line-height: 1.2;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .prc { font-size: 7pt; font-weight: bold; color: #92400e; margin-top: 0.3mm; }
    @media print { body { margin: 0; padding: 6mm; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="lbl"><canvas id="bc0"></canvas>
      <div class="nom" title="${nombre.replace(/"/g,'&quot;')}">${nombre.replace(/</g,'&lt;')}</div>
      <div class="prc">S/ ${precio.toFixed(2)}</div>
    </div>
    <div class="lbl"><canvas id="bc1"></canvas>
      <div class="nom" title="${nombre.replace(/"/g,'&quot;')}">${nombre.replace(/</g,'&lt;')}</div>
      <div class="prc">S/ ${precio.toFixed(2)}</div>
    </div>
    <div class="lbl"><canvas id="bc2"></canvas>
      <div class="nom" title="${nombre.replace(/"/g,'&quot;')}">${nombre.replace(/</g,'&lt;')}</div>
      <div class="prc">S/ ${precio.toFixed(2)}</div>
    </div>
    <div class="lbl"><canvas id="bc3"></canvas>
      <div class="nom" title="${nombre.replace(/"/g,'&quot;')}">${nombre.replace(/</g,'&lt;')}</div>
      <div class="prc">S/ ${precio.toFixed(2)}</div>
    </div>
  </div>
  <script>
    window.onload = function() {
      const codigo = ${JSON.stringify(codigo)};
      [0,1,2,3].forEach(function(i) {
        try {
          JsBarcode('#bc' + i, codigo, {
            format: 'CODE128', displayValue: true,
            fontSize: 9, textMargin: 1,
            margin: 2, width: 1.2, height: 28,
            background: '#ffffff', lineColor: '#000000'
          });
        } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=600,height=400');
    if (!win) return app.showToast('Permite las ventanas emergentes en tu navegador', 'error');
    win.document.open();
    win.document.write(html);
    win.document.close();
  },

  load() {
    this.bindEvents();
    this.loadData();
    window.invExportExcel    = this.exportExcel.bind(this);
    window.invScan            = () => this.scanProducto();
    window.invAbrirEdicion    = () => this.abrirEdicion();
    window.invGuardarEdicion  = () => this.guardarEdicion();
    window.invImprimirEtiqueta = () => this.imprimirEtiqueta();
    window.invCloseModal      = () => {
      const m = document.getElementById('inv-scan-modal');
      if (m) m.style.display = 'none';
    };
    window.invCloseEditModal  = () => {
      const em = document.getElementById('inv-edit-modal');
      if (em) em.style.display = 'none';
    };
  }
};
