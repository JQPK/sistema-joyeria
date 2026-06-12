import { api } from '../api.js';

export default {
  container: null,
  chartLine: null,
  chartBar: null,

  async init(container) {
    this.container = container;
    
    // Default to this month
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="text-gold">Reporte de Ventas</h2>
        </div>
        <div class="card-body">
          <div class="flex flex-wrap gap-4" style="margin-bottom: 2rem">
            <div class="form-group mb-0">
              <label class="form-label">Desde</label>
              <input type="date" id="rep-fecha-inicio" class="form-control" value="${firstDay}">
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Hasta</label>
              <input type="date" id="rep-fecha-fin" class="form-control" value="${lastDay}">
            </div>
            <div class="form-group mb-0" style="display:flex; align-items:flex-end">
              <button class="btn btn-primary" onclick="window.repLoad()">Generar Reporte</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem">
            <div class="card" style="box-shadow:none; border:1px solid var(--bg-secondary)">
              <div class="card-header"><h3 style="font-size: 1rem">Evolución de Ingresos</h3></div>
              <div class="card-body"><div class="chart-container"><canvas id="rep-chart-line"></canvas></div></div>
            </div>
            
            <div class="card" style="box-shadow:none; border:1px solid var(--bg-secondary)">
              <div class="card-header"><h3 style="font-size: 1rem">Número de Transacciones</h3></div>
              <div class="card-body"><div class="chart-container"><canvas id="rep-chart-bar"></canvas></div></div>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const start = document.getElementById('rep-fecha-inicio').value;
      const end = document.getElementById('rep-fecha-fin').value;

      const res = await api.get('/ventas/daily-stats', { fechaInicio: start, fechaFin: end });
      if (res.success) {
        this.renderCharts(res.data);
      }
    } catch (err) {
      app.showToast('Error generando reporte', 'error');
    }
  },

  renderCharts(data) {
    const ctxLine = document.getElementById('rep-chart-line');
    const ctxBar = document.getElementById('rep-chart-bar');
    if (!ctxLine || !ctxBar) return;

    if (this.chartLine) this.chartLine.destroy();
    if (this.chartBar) this.chartBar.destroy();

    const labels = data.map(d => {
      const date = new Date(d.dia + 'T00:00:00');
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
    });
    
    const amounts = data.map(d => parseFloat(d.total));
    const counts = data.map(d => parseInt(d.num_ventas, 10));

    this.chartLine = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Vendido (S/)',
          data: amounts,
          borderColor: '#C9A96E',
          backgroundColor: 'rgba(201, 169, 110, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    this.chartBar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Transacciones',
          data: counts,
          backgroundColor: '#8EAFC2',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  },

  load() {
    window.repLoad = this.loadData.bind(this);
  }
};
