import { api } from '../api.js';

export default {
  container: null,

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

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1rem">
          <div class="card">
            <div class="card-header">
              <h3 style="font-size: 1.1rem">Top 10 Más Vendidos</h3>
            </div>
            <div class="card-body" style="padding: 0">
              <div class="table-container">
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
              <div class="table-container">
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
            <div class="flex gap-2">
              <div class="form-control flex items-center" style="min-width: 200px; padding:0; width:auto">
                <input type="text" id="inv-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar producto...">
              </div>
              <button class="btn btn-secondary flex items-center gap-2" onclick="window.invExportExcel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Exportar Excel
              </button>
            </div>
          </div>
          <div class="card-body" style="padding: 0">
            <div class="table-container">
              <table class="data-table" id="inv-full-table">
                <thead>
                  <tr>
                    <th>Código/SKU</th>
                    <th>Producto/Variante</th>
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

    await this.loadData();
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
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay productos en inventario</td></tr>';
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

  load() {
    this.bindEvents();
    this.loadData();
    window.invExportExcel = this.exportExcel.bind(this);
  }
};
