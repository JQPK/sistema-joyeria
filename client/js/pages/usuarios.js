import { api } from '../api.js';
import { auth } from '../auth.js';

export default {
  container: null,
  usuarios: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-gold">Usuarios del Sistema</h2>
          <button class="btn btn-primary" onclick="window.usrOpenModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Nuevo Usuario
          </button>
        </div>
        
        <div class="card-body">
          <div class="table-container">
            <table class="data-table" id="usr-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Username</th>
                  <th>Rol</th>
                  <th>Estado</th>
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
      <div id="modal-usuario" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold" id="usr-modal-title">Nuevo Usuario</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-usuario')">✕</button>
          </div>
          <div class="modal-body">
            <form id="usr-form">
              <input type="hidden" id="usr-id">
              
              <div class="form-group">
                <label class="form-label">Nombre Completo *</label>
                <input type="text" id="usr-nombre" class="form-control" required>
              </div>

              <div class="form-group">
                <label class="form-label">Nombre de Usuario (Login) *</label>
                <input type="text" id="usr-username" class="form-control" required>
              </div>

              <div class="form-group">
                <label class="form-label">Contraseña <span id="usr-pwd-hint" class="text-muted" style="font-weight:normal">(Obligatorio)</span></label>
                <input type="password" id="usr-pwd" class="form-control">
              </div>

              <div class="form-group">
                <label class="form-label">Rol del Sistema</label>
                <select id="usr-rol" class="form-control">
                  <option value="cajero">Cajero (Solo POS y Clientes)</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-usuario')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.usrSave()">Guardar</button>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await api.get('/usuarios');
      if (res.success) {
        this.usuarios = res.data;
        this.renderTable(this.usuarios);
      }
    } catch (err) {
      app.showToast('Error cargando usuarios', 'error');
    }
  },

  renderTable(data) {
    const tbody = document.querySelector('#usr-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No se encontraron usuarios</td></tr>';
      return;
    }

    const currentUserId = auth.getUser().id;

    tbody.innerHTML = data.map(u => `
      <tr>
        <td class="fw-bold">${u.nombre}</td>
        <td>${u.username}</td>
        <td style="text-transform:capitalize">${u.rol}</td>
        <td>
          <span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">
            ${u.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="text-right">
          <button class="btn-icon btn-secondary" onclick="window.usrEdit(${u.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          ${u.id !== currentUserId ? `
            <button class="btn-icon ${u.activo ? 'btn-danger' : 'btn-success'}" onclick="window.usrToggle(${u.id})" title="${u.activo ? 'Desactivar' : 'Activar'}" style="margin-left:0.5rem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  },

  openModal(id = null) {
    const isEdit = id !== null;
    document.getElementById('usr-modal-title').textContent = isEdit ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('usr-pwd-hint').textContent = isEdit ? '(Dejar en blanco para no cambiar)' : '(Obligatorio)';
    
    if (isEdit) {
      const u = this.usuarios.find(x => x.id === id);
      document.getElementById('usr-id').value = u.id;
      document.getElementById('usr-nombre').value = u.nombre;
      document.getElementById('usr-username').value = u.username;
      document.getElementById('usr-rol').value = u.rol;
      document.getElementById('usr-pwd').value = '';
    } else {
      document.getElementById('usr-form').reset();
      document.getElementById('usr-id').value = '';
    }

    app.openModal('modal-usuario');
  },

  async save() {
    const id = document.getElementById('usr-id').value;
    const isEdit = !!id;
    
    const payload = {
      nombre: document.getElementById('usr-nombre').value,
      username: document.getElementById('usr-username').value,
      rol: document.getElementById('usr-rol').value
    };

    const pwd = document.getElementById('usr-pwd').value;
    if (pwd) payload.password = pwd;

    if (!isEdit && !pwd) {
      return app.showToast('La contraseña es obligatoria para nuevos usuarios', 'error');
    }

    try {
      if (isEdit) {
        await api.put(`/usuarios/${id}`, payload);
        app.showToast('Usuario actualizado', 'success');
      } else {
        await api.post('/usuarios', payload);
        app.showToast('Usuario creado', 'success');
      }
      app.closeModal('modal-usuario');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async toggle(id) {
    if (!confirm('¿Cambiar estado de este usuario?')) return;
    try {
      await api.post(`/usuarios/${id}/toggle`);
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  load() {
    window.usrOpenModal = this.openModal.bind(this);
    window.usrSave = this.save.bind(this);
    window.usrEdit = this.openModal.bind(this);
    window.usrToggle = this.toggle.bind(this);
  }
};
