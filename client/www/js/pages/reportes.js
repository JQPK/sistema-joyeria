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
          <div class="mobile-filter-row" style="margin-bottom: 1.5rem">
            <div class="form-group mb-0">
              <label class="form-label">Desde</label>
              <input type="date" id="rep-fecha-inicio" class="form-control" value="${firstDay}">
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Hasta</label>
              <input type="date" id="rep-fecha-fin" class="form-control" value="${lastDay}">
            </div>
            <div class="form-group mb-0" style="display:flex; align-items:flex-end">
              <button class="btn btn-primary w-full" onclick="window.repLoad()">Generar Reporte</button>
            </div>
          </div>

          <!-- Resumen por método de pago -->
          <div id="rep-pago-summary" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:.75rem; margin-bottom:1.5rem"></div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem">
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
      const end   = document.getElementById('rep-fecha-fin').value;

      const [resStats, resVentas] = await Promise.all([
        api.get('/ventas/daily-stats', { fechaInicio: start, fechaFin: end }),
        api.get('/ventas', { fecha_inicio: start, fecha_fin: end, limit: 'false' })
      ]);

      if (resStats.success)  this.renderCharts(resStats.data);
      if (resVentas.success) this.renderPagoSummary(resVentas.data);
    } catch (err) {
      app.showToast('Error generando reporte', 'error');
    }
  },

  renderPagoSummary(ventas) {
    const el = document.getElementById('rep-pago-summary');
    if (!el) return;

    // Solo ventas completadas
    const completadas = ventas.filter(v => v.estado === 'completada');
    const total = completadas.reduce((s, v) => s + parseFloat(v.total), 0);

    // Agrupar por metodo_pago
    const grupos = {};
    for (const v of completadas) {
      const m = v.metodo_pago || 'efectivo';
      grupos[m] = (grupos[m] || 0) + parseFloat(v.total);
    }

    const labelMap = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Yape / Transf.' };
    const iconMap  = { efectivo: '💵', tarjeta: '💳', transferencia: '📲' };
    const colorMap = {
      efectivo:      { bg: 'rgba(74,222,128,.12)',  border: '#16a34a', text: '#16a34a' },
      tarjeta:       { bg: 'rgba(96,165,250,.12)',  border: '#1d4ed8', text: '#1d4ed8' },
      transferencia: { bg: 'rgba(167,139,250,.12)', border: '#7c3aed', text: '#7c3aed' }
    };

    // Tarjeta TOTAL primero
    const cards = [`
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:.9rem 1rem">
        <div style="font-size:.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem">📊 Total vendido</div>
        <div style="font-size:1.3rem; font-weight:700; color:var(--accent-gold-dark)">S/ ${total.toFixed(2)}</div>
        <div style="font-size:.72rem; color:var(--text-muted); margin-top:.2rem">${completadas.length} venta${completadas.length !== 1 ? 's' : ''}</div>
      </div>
    `];

    // Tarjeta por cada método presente
    for (const [m, monto] of Object.entries(grupos)) {
      const pct = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
      const c = colorMap[m] || { bg: 'var(--bg-secondary)', border: 'var(--border)', text: 'var(--text-primary)' };
      cards.push(`
        <div style="background:${c.bg}; border:1px solid ${c.border}; border-radius:12px; padding:.9rem 1rem">
          <div style="font-size:.72rem; color:${c.text}; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem">
            ${iconMap[m] || '💰'} ${labelMap[m] || m}
          </div>
          <div style="font-size:1.2rem; font-weight:700; color:${c.text}">S/ ${monto.toFixed(2)}</div>
          <div style="font-size:.72rem; color:${c.text}; opacity:.8; margin-top:.2rem">${pct}% del total</div>
        </div>
      `);
    }

    el.innerHTML = cards.join('');
  },

  renderCharts(data) {
    const ctxLine = document.getElementById('rep-chart-line');
    const ctxBar = document.getElementById('rep-chart-bar');
    if (!ctxLine || !ctxBar) return;

    if (this.chartLine) this.chartLine.destroy();
    if (this.chartBar) this.chartBar.destroy();

    const labels = data.map(d => {
      const date = new Date(d.dia);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
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
