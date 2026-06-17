import { api } from '../api.js';
import { auth } from '../auth.js';

export default {
  container: null,
  movimientos: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-gold">Caja Chica</h2>
          <button class="btn btn-danger" onclick="window.cajaOpenModal('egreso')">
            Registrar Gasto (Egreso)
          </button>
        </div>
        
        <div class="card-body">
          <div class="stats-grid" style="margin-bottom: 2rem">
            <div class="card stat-card" style="border-left: 4px solid var(--color-success)">
              <div class="stat-icon" style="background: rgba(129, 178, 154, 0.1); color: var(--color-success)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              </div>
              <div>
                <div class="text-muted" style="font-size: 0.9rem">Ingresos</div>
                <div class="fw-bold text-success" style="font-size: 1.5rem" id="caja-ingresos">S/ 0.00</div>
              </div>
            </div>
            
            <div class="card stat-card" style="border-left: 4px solid var(--color-danger)">
              <div class="stat-icon" style="background: rgba(224, 122, 95, 0.1); color: var(--color-danger)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
              </div>
              <div>
                <div class="text-muted" style="font-size: 0.9rem">Egresos</div>
                <div class="fw-bold text-danger" style="font-size: 1.5rem" id="caja-egresos">S/ 0.00</div>
              </div>
            </div>

            <div class="card stat-card" style="border-left: 4px solid var(--accent-gold)">
              <div class="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>
              </div>
              <div>
                <div class="text-muted" style="font-size: 0.9rem">Saldo Neto</div>
                <div class="fw-bold text-gold" style="font-size: 1.5rem" id="caja-saldo">S/ 0.00</div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-4" style="margin-bottom: 1.5rem; justify-content: space-between;">
            <div class="flex gap-2">
              <input type="date" id="caja-fecha" class="form-control" style="width:auto">
              <button class="btn btn-secondary" onclick="window.cajaLoad()">Filtrar Día</button>
            </div>
            <button class="btn btn-secondary flex items-center gap-2" onclick="window.cajaExport()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Exportar Excel
            </button>
          </div>

          <div class="table-container">
            <table class="data-table" id="caja-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Usuario</th>
                  <th class="text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Egreso -->
      <div id="modal-caja-mov" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-danger">Registrar Egreso</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-caja-mov')">✕</button>
          </div>
          <div class="modal-body">
            <form id="caja-form">
              <input type="hidden" id="caja-tipo" value="egreso">
              
              <div class="form-group">
                <label class="form-label">Concepto *</label>
                <input type="text" id="caja-concepto" class="form-control" required placeholder="Ej: Pago de servicios, limpieza...">
              </div>

              <div class="form-group">
                <label class="form-label">Monto (S/) *</label>
                <input type="number" id="caja-monto" class="form-control" step="0.01" min="0.1" required>
              </div>

              <div class="form-group">
                <label class="form-label">Notas Opcionales</label>
                <textarea id="caja-notas" class="form-control" rows="2"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-caja-mov')">Cancelar</button>
            <button class="btn btn-danger" onclick="window.cajaSave()">Registrar Gasto</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('caja-fecha').value = new Date().toISOString().split('T')[0];
    await this.loadData();
  },

  async loadData() {
    try {
      const fecha = document.getElementById('caja-fecha').value;

      const [movRes, resRes] = await Promise.all([
        api.get('/caja', { fecha_inicio: fecha, fecha_fin: fecha }),
        api.get('/caja/resumen', { fechaInicio: fecha, fechaFin: fecha })
      ]);

      if (resRes.success) {
        document.getElementById('caja-ingresos').textContent = `S/ ${parseFloat(resRes.data.total_ingresos).toFixed(2)}`;
        document.getElementById('caja-egresos').textContent = `S/ ${parseFloat(resRes.data.total_egresos).toFixed(2)}`;
        document.getElementById('caja-saldo').textContent = `S/ ${parseFloat(resRes.data.saldo_neto).toFixed(2)}`;
      }

      if (movRes.success) {
        this.movimientos = movRes.data;
        this.renderTable(this.movimientos);
      }
    } catch (err) {
      app.showToast('Error cargando datos de caja', 'error');
    }
  },

  renderTable(data) {
    const tbody = document.querySelector('#caja-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay movimientos en este día</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(m => {
      const horaStr = new Date(m.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const isIngreso = m.tipo === 'ingreso';
      return `
      <tr>
        <td class="text-muted">${horaStr}</td>
        <td>
          <span class="badge ${isIngreso ? 'badge-success' : 'badge-danger'}">
            ${m.tipo.toUpperCase()}
          </span>
        </td>
        <td class="fw-bold">${m.concepto}</td>
        <td>${m.usuario_nombre}</td>
        <td class="text-right fw-bold ${isIngreso ? 'text-success' : 'text-danger'}">
          ${isIngreso ? '+' : '-'} S/ ${parseFloat(m.monto).toFixed(2)}
        </td>
      </tr>
    `}).join('');
  },

  openModal() {
    document.getElementById('caja-form').reset();
    app.openModal('modal-caja-mov');
  },

  async save() {
    const payload = {
      tipo: 'egreso',
      concepto: document.getElementById('caja-concepto').value,
      monto: document.getElementById('caja-monto').value,
      notas: document.getElementById('caja-notas').value
    };

    if (!payload.concepto || !payload.monto) {
      return app.showToast('Concepto y Monto son obligatorios', 'error');
    }

    try {
      await api.post('/caja', payload);
      app.showToast('Gasto registrado', 'success');
      app.closeModal('modal-caja-mov');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  exportExcel() {
    if (!this.movimientos || this.movimientos.length === 0) {
      return app.showToast('No hay datos para exportar', 'warning');
    }

    const data = this.movimientos.map(m => ({
      'Fecha y Hora': new Date(m.fecha).toLocaleString('es-PE'),
      'Tipo': m.tipo.toUpperCase(),
      'Concepto': m.concepto,
      'Usuario': m.usuario_nombre,
      'Monto (S/)': parseFloat(m.monto).toFixed(2),
      'Notas': m.notas || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Caja");

    const dateStr = document.getElementById('caja-fecha').value || new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Reporte_Caja_${dateStr}.xlsx`);
  },

  load() {
    window.cajaLoad = this.loadData.bind(this);
    window.cajaOpenModal = this.openModal.bind(this);
    window.cajaSave = this.save.bind(this);
    window.cajaExport = this.exportExcel.bind(this);
  }
};
