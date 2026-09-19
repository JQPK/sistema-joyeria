import { api } from '../api.js';

export default {
  container: null,
  chart: null,

  async init(container) {
    this.container = container;
    // Default to the globally selected store
    this.currentViewId = localStorage.getItem('activeSucursal') || '';
    
    this.container.innerHTML = `
      <div class="flex-col gap-4">
        
        <div id="dash-admin-tabs" class="flex flex-wrap gap-2" style="display: none; margin-bottom: 0.5rem">
          <!-- Inject tabs here -->
        </div>

        <h2 class="text-gold" style="margin-bottom: 1rem" id="dash-title">Resumen de Hoy</h2>
        
        <div class="stats-grid">
          <div class="card stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Ventas Hoy</div>
              <div class="fw-bold text-primary" style="font-size: 1.5rem" id="dash-total-ventas">S/ 0.00</div>
            </div>
          </div>
          
          <div class="card stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Operaciones</div>
              <div class="fw-bold text-primary" style="font-size: 1.5rem" id="dash-operaciones">0</div>
            </div>
          </div>

          <div class="card stat-card">
            <div class="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div>
              <div class="text-muted" style="font-size: 0.9rem">Ticket Promedio</div>
              <div class="fw-bold text-primary" style="font-size: 1.5rem" id="dash-ticket">S/ 0.00</div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 1rem">
          <div class="card">
            <div class="card-header">
              <h3 style="font-size: 1.1rem">Ventas (Últimos 7 días)</h3>
            </div>
            <div class="card-body">
              <div class="chart-container">
                <canvas id="dashboard-chart"></canvas>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 style="font-size: 1.1rem">Últimas Ventas</h3>
              <a href="#comprobantes" class="text-gold" style="font-size: 0.9rem">Ver todo</a>
            </div>
            <div class="card-body" style="padding: 0">
              <div class="table-responsive">
                <table class="data-table" id="dash-recent-table">
                  <tbody>
                    <tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    await this.load();
  },

  async load() {
    try {
      // 1. Render Admin Tabs if applicable
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const tabsContainer = document.getElementById('dash-admin-tabs');
      
      if (user.rol === 'admin' && app.sucursales) {
        tabsContainer.style.display = 'flex';
        let tabsHtml = `<button class="btn btn-sm ${this.currentViewId === 'todas' ? 'btn-primary' : 'btn-secondary'} dash-tab" data-id="todas">🌐 Vista Global (Todas)</button>`;
        app.sucursales.forEach(s => {
          const isActive = String(this.currentViewId) === String(s.id) || (!this.currentViewId && String(s.id) === '1');
          if (isActive) this.currentViewId = s.id; // sync string/int
          tabsHtml += `<button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'} dash-tab" data-id="${s.id}">🏪 ${s.nombre}</button>`;
        });
        tabsContainer.innerHTML = tabsHtml;

        // Bind clicks
        tabsContainer.querySelectorAll('.dash-tab').forEach(btn => {
          btn.addEventListener('click', (e) => {
            this.currentViewId = e.target.dataset.id;
            this.load(); // reload data
          });
        });
      }

      // Update Title
      let titleSuffix = '';
      if (user.rol === 'admin') {
        if (this.currentViewId === 'todas') titleSuffix = ' (Global)';
        else {
          const suc = app.sucursales?.find(s => String(s.id) === String(this.currentViewId));
          if (suc) titleSuffix = ` (${suc.nombre})`;
        }
      }
      document.getElementById('dash-title').textContent = `Resumen de Hoy${titleSuffix}`;

      // 2. Load Data (force sucursal_id parameter to override api.js auto-injector)
      const params = { sucursal_id: this.currentViewId };

      // Load today's stats
      const statsRes = await api.get('/ventas/stats/today', params);
      if (statsRes.success) {
        document.getElementById('dash-total-ventas').textContent = `S/ ${parseFloat(statsRes.data.total_monto).toFixed(2)}`;
        document.getElementById('dash-operaciones').textContent = statsRes.data.total_ventas;
        document.getElementById('dash-ticket').textContent = `S/ ${parseFloat(statsRes.data.ticket_promedio).toFixed(2)}`;
      }

      // Load weekly chart
      const chartRes = await api.get('/ventas/daily-stats', params);
      if (chartRes.success) {
        this.renderChart(chartRes.data);
      }

      // Load recent sales
      const recentRes = await api.get('/ventas', { limit: true, ...params });
      if (recentRes.success) {
        this.renderRecentSales(recentRes.data.slice(0, 5));
      }
    } catch (err) {
      console.error('Error loading dashboard', err);
      app.showToast('Error al cargar datos del dashboard', 'error');
    }
  },

  renderChart(data) {
    const ctx = document.getElementById('dashboard-chart');
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    const labels = data.map(d => {
      const date = new Date(d.dia);
      // Correct timezone offset issue if it's treated as UTC
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      return date.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
    });
    
    const amounts = data.map(d => parseFloat(d.total));

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ventas (S/)',
          data: amounts,
          backgroundColor: '#C9A96E',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  renderRecentSales(sales) {
    const tbody = document.querySelector('#dash-recent-table tbody');
    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay ventas recientes</td></tr>';
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td class="fw-bold">${s.numero_comprobante}</td>
        <td>${s.cliente_nombre || 'Cliente General'}</td>
        <td>
          <span class="badge ${s.estado === 'completada' ? 'badge-success' : 'badge-danger'}">
            ${s.estado}
          </span>
        </td>
        <td class="text-right fw-bold text-gold">S/ ${parseFloat(s.total).toFixed(2)}</td>
      </tr>
    `).join('');
  },

  onRealtimeEvent(eventName) {
    if (eventName === 'sale:created' || eventName === 'sale:voided') {
      this.load();
    }
  }
};
