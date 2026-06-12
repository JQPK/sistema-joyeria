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

    } catch (err) {
      app.showToast('Error cargando datos de inventario', 'error');
    }
  },

  load() {
    this.loadData();
  }
};
