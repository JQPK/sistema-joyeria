import { api } from '../api.js';

export default {
  container: null,
  clientes: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-gold">Clientes</h2>
          <button class="btn btn-primary" onclick="window.cliOpenModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Nuevo Cliente
          </button>
        </div>
        
        <div class="card-body">
          <div class="form-control flex items-center" style="max-width: 400px; padding:0; margin-bottom: 1.5rem">
            <input type="text" id="cli-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar por DNI, RUC o Nombre...">
          </div>

          <div class="table-container">
            <table class="data-table" id="cli-table">
              <thead>
                <tr>
                  <th>Nombre / Razón Social</th>
                  <th>DNI / RUC</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Crear/Editar -->
      <div id="modal-cliente" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold" id="cli-modal-title">Nuevo Cliente</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-cliente')">✕</button>
          </div>
          <div class="modal-body">
            <form id="cli-form">
              <input type="hidden" id="cli-id">
              
              <div class="form-group">
                <label class="form-label">Nombre Completo / Razón Social *</label>
                <input type="text" id="cli-nombre" class="form-control" required>
              </div>

              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">DNI / RUC</label>
                  <input type="text" id="cli-doc" class="form-control">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Teléfono</label>
                  <input type="text" id="cli-tel" class="form-control">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="cli-email" class="form-control">
              </div>

              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" id="cli-dir" class="form-control">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-cliente')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.cliSave()">Guardar</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    const search = document.getElementById('cli-search');
    search.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = this.clientes.filter(c => 
        c.nombre.toLowerCase().includes(term) || 
        (c.dni_ruc && c.dni_ruc.toLowerCase().includes(term)) ||
        (c.telefono && c.telefono.toLowerCase().includes(term))
      );
      this.renderTable(filtered);
    });
  },

  async loadData() {
    try {
      const res = await api.get('/clientes');
      if (res.success) {
        this.clientes = res.data;
        this.renderTable(this.clientes);
      }
    } catch (err) {
      app.showToast('Error cargando clientes', 'error');
    }
  },

  renderTable(data) {
    const tbody = document.querySelector('#cli-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No se encontraron clientes</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(c => `
      <tr>
        <td class="fw-bold">${c.nombre}</td>
        <td>${c.dni_ruc || '-'}</td>
        <td>${c.telefono || '-'}</td>
        <td>${c.email || '-'}</td>
        <td class="text-right">
          <button class="btn-icon btn-secondary" onclick="window.cliEdit(${c.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon btn-danger" onclick="window.cliDelete(${c.id})" title="Eliminar" style="margin-left:0.5rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `).join('');
  },

  openModal(id = null) {
    const isEdit = id !== null;
    document.getElementById('cli-modal-title').textContent = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';
    
    if (isEdit) {
      const c = this.clientes.find(x => x.id === id);
      document.getElementById('cli-id').value = c.id;
      document.getElementById('cli-nombre').value = c.nombre;
      document.getElementById('cli-doc').value = c.dni_ruc || '';
      document.getElementById('cli-tel').value = c.telefono || '';
      document.getElementById('cli-email').value = c.email || '';
      document.getElementById('cli-dir').value = c.direccion || '';
    } else {
      document.getElementById('cli-form').reset();
      document.getElementById('cli-id').value = '';
    }

    app.openModal('modal-cliente');
  },

  async save() {
    const id = document.getElementById('cli-id').value;
    const isEdit = !!id;
    
    const payload = {
      nombre: document.getElementById('cli-nombre').value,
      dni_ruc: document.getElementById('cli-doc').value,
      telefono: document.getElementById('cli-tel').value,
      email: document.getElementById('cli-email').value,
      direccion: document.getElementById('cli-dir').value
    };

    if (!payload.nombre) {
      return app.showToast('El nombre es obligatorio', 'error');
    }

    try {
      if (isEdit) {
        await api.put(`/clientes/${id}`, payload);
        app.showToast('Cliente actualizado', 'success');
      } else {
        await api.post('/clientes', payload);
        app.showToast('Cliente creado', 'success');
      }
      app.closeModal('modal-cliente');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async deleteCli(id) {
    if (!confirm('¿Seguro que deseas eliminar este cliente?')) return;
    try {
      await api.del(`/clientes/${id}`);
      app.showToast('Cliente eliminado', 'success');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  load() {
    window.cliOpenModal = this.openModal.bind(this);
    window.cliSave = this.save.bind(this);
    window.cliEdit = this.openModal.bind(this);
    window.cliDelete = this.deleteCli.bind(this);
  }
};
