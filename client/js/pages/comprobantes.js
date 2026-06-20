import { api } from '../api.js';
import { auth } from '../auth.js';

export default {
  container: null,
  ventas: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="text-gold">Comprobantes y Ventas</h2>
        </div>
        
        <div class="card-body">
          <div class="mobile-filter-row" style="margin-bottom: 1rem">
            <div class="form-control flex items-center" style="padding:0; min-width:0">
              <input type="text" id="comp-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar comprobante...">
            </div>
            <select id="comp-filter-estado" class="form-control">
              <option value="">Todos los Estados</option>
              <option value="completada">Completada</option>
              <option value="anulada">Anulada</option>
            </select>
            <input type="date" id="comp-fecha-inicio" class="form-control">
            <input type="date" id="comp-fecha-fin" class="form-control">
            <button class="btn btn-secondary w-full" onclick="window.compLoad()">Filtrar</button>
          </div>

          <div class="table-responsive">
            <table class="data-table" id="comp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comprobante</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="6" class="text-center text-muted">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Ver Detalle -->
      <div id="modal-detalle-venta" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold" id="comp-modal-title">Detalle de Venta</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-detalle-venta')">✕</button>
          </div>
          <div class="modal-body">
            <div id="comp-detalle-content">Cargando...</div>
          </div>
          <div class="modal-footer" id="comp-detalle-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-detalle-venta')">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    
    // Set default dates to today
    // Default to empty dates to show recent ones
    document.getElementById('comp-fecha-inicio').value = '';
    document.getElementById('comp-fecha-fin').value = '';

    await this.loadData();
  },

  bindEvents() {
    const search = document.getElementById('comp-search');
    const estado = document.getElementById('comp-filter-estado');

    search.addEventListener('input', () => this.filterTable());
    estado.addEventListener('change', () => this.filterTable());
  },

  async loadData() {
    try {
      const fechaInicio = document.getElementById('comp-fecha-inicio').value;
      const fechaFin = document.getElementById('comp-fecha-fin').value;

      const res = await api.get('/ventas', { fecha_inicio: fechaInicio, fecha_fin: fechaFin });
      if (res.success) {
        this.ventas = res.data;
        this.renderTable(this.ventas);
      }
    } catch (err) {
      app.showToast('Error cargando comprobantes', 'error');
    }
  },

  filterTable() {
    const term = document.getElementById('comp-search').value.toLowerCase();
    const estado = document.getElementById('comp-filter-estado').value;

    const filtered = this.ventas.filter(v => {
      const matchTerm = (v.numero_comprobante && v.numero_comprobante.toLowerCase().includes(term)) || 
                        (v.cliente_nombre && v.cliente_nombre.toLowerCase().includes(term));
      const matchEstado = estado ? v.estado === estado : true;
      return matchTerm && matchEstado;
    });

    this.renderTable(filtered);
  },

  renderTable(data) {
    const tbody = document.querySelector('#comp-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se encontraron comprobantes</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(v => {
      const fechaStr = new Date(v.fecha).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      return `
      <tr>
        <td class="text-muted">${fechaStr}</td>
        <td class="fw-bold">${v.numero_comprobante}</td>
        <td>${v.cliente_nombre || 'Cliente General'}</td>
        <td class="fw-bold text-gold">S/ ${parseFloat(v.total).toFixed(2)}</td>
        <td>
          <span class="badge ${v.estado === 'completada' ? 'badge-success' : 'badge-danger'}">
            ${v.estado}
          </span>
        </td>
        <td class="text-right">
          <button class="btn-icon btn-secondary" onclick="window.compView(${v.id})" title="Ver Detalle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </td>
      </tr>
    `}).join('');
  },

  async viewDetails(id) {
    document.getElementById('comp-modal-title').textContent = 'Cargando...';
    document.getElementById('comp-detalle-content').innerHTML = '<div class="text-center">Cargando detalles...</div>';
    app.openModal('modal-detalle-venta');

    try {
      const res = await api.get(`/ventas/${id}`);
      if (res.success) {
        const v = res.data;
        document.getElementById('comp-modal-title').textContent = `Venta ${v.numero_comprobante}`;
        
        const fechaStr = new Date(v.fecha).toLocaleString('es-PE');
        
        let html = `
          <div class="flex-col gap-4">
            <div class="card bg-secondary" style="background:var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius-sm)">
              <div class="flex justify-between" style="margin-bottom:0.5rem">
                <span class="text-muted">Fecha:</span> <span class="fw-bold">${fechaStr}</span>
              </div>
              <div class="flex justify-between" style="margin-bottom:0.5rem">
                <span class="text-muted">Cliente:</span> <span class="fw-bold">${v.cliente_nombre || 'General'}</span>
              </div>
              <div class="flex justify-between" style="margin-bottom:0.5rem">
                <span class="text-muted">Vendedor:</span> <span class="fw-bold">${v.vendedor_nombre}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Estado:</span> 
                <span class="badge ${v.estado === 'completada' ? 'badge-success' : 'badge-danger'}">${v.estado}</span>
              </div>
            </div>

            <table class="data-table" style="font-size: 0.9rem">
              <thead>
                <tr>
                  <th>Cant</th>
                  <th>Producto</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${v.items.map(i => `
                  <tr>
                    <td>${i.cantidad}</td>
                    <td>${i.producto_nombre} <br><small class="text-muted">${i.producto_codigo}</small></td>
                    <td class="text-right">S/ ${parseFloat(i.subtotal_item).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="text-right fw-bold text-gold" style="font-size: 1.2rem; padding-top: 1rem; border-top: 2px dashed var(--bg-secondary)">
              Total: S/ ${parseFloat(v.total).toFixed(2)}
            </div>
          </div>
        `;
        document.getElementById('comp-detalle-content').innerHTML = html;

        let footerHtml = `<button class="btn btn-secondary" onclick="app.closeModal('modal-detalle-venta')">Cerrar</button>`;
        if (v.estado === 'completada' && auth.isAdmin()) {
          footerHtml = `<button class="btn btn-danger" onclick="window.compVoid(${v.id})">Anular Venta</button>` + footerHtml;
        }
        document.getElementById('comp-detalle-footer').innerHTML = footerHtml;
      }
    } catch (err) {
      document.getElementById('comp-detalle-content').innerHTML = `<div class="text-danger">${err.message}</div>`;
    }
  },

  async voidSale(id) {
    const motivo = prompt('Motivo de la anulación (obligatorio):');
    if (!motivo) return;

    try {
      await api.post(`/ventas/${id}/anular`, { motivo });
      app.showToast('Venta anulada correctamente', 'success');
      app.closeModal('modal-detalle-venta');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  load() {
    window.compLoad = this.loadData.bind(this);
    window.compView = this.viewDetails.bind(this);
    window.compVoid = this.voidSale.bind(this);
  }
};
