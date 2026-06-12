import { api } from '../api.js';

export default {
  container: null,

  async init(container) {
    this.container = container;
    
    const today = new Date().toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="text-gold">Bitácora de Actividad</h2>
        </div>
        
        <div class="card-body">
          <div class="flex flex-wrap gap-4" style="margin-bottom: 1.5rem">
            <input type="date" id="bit-fecha-inicio" class="form-control" style="width:auto" value="${today}">
            <input type="date" id="bit-fecha-fin" class="form-control" style="width:auto" value="${today}">
            <button class="btn btn-secondary" onclick="window.bitLoad()">Filtrar</button>
          </div>

          <div class="table-container">
            <table class="data-table" id="bit-table">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const fechaInicio = document.getElementById('bit-fecha-inicio').value;
      const fechaFin = document.getElementById('bit-fecha-fin').value;

      const res = await api.get('/actividad', { fecha_inicio: fechaInicio, fecha_fin: fechaFin });
      if (res.success) {
        this.renderTable(res.data);
      }
    } catch (err) {
      app.showToast('Error cargando bitácora', 'error');
    }
  },

  renderTable(data) {
    const tbody = document.querySelector('#bit-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay actividad registrada en este rango</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(a => {
      const fechaStr = new Date(a.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
      return `
      <tr>
        <td class="text-muted" style="font-size:0.9rem">${fechaStr}</td>
        <td class="fw-bold">${a.usuario_nombre} <small class="text-muted">(${a.usuario_rol})</small></td>
        <td><span class="badge" style="background:var(--bg-secondary); color:var(--text-primary)">${a.accion}</span></td>
        <td class="text-muted" style="font-size:0.9rem">${a.detalles || '-'}</td>
      </tr>
    `}).join('');
  },

  load() {
    window.bitLoad = this.loadData.bind(this);
  }
};
