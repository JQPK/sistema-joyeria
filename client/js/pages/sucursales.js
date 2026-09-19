import { api } from '../api.js';

export default {
  container: null,

  async init(container) {
    this.container = container;
    this.render();
    this.bindEvents();
    await this.load();
  },

  render() {
    this.container.innerHTML = `
      <div class="card p-lg mb">
        <div class="flex justify-between items-center mb">
          <h2 class="text-gold" style="margin:0">Gestión de Sucursales</h2>
          <button class="btn btn-primary" id="btn-nueva-sucursal">+ Nueva Sucursal</button>
        </div>
        <p class="text-muted mb">Administra las tiendas físicas. El catálogo de productos es el mismo para todas, pero el inventario se maneja de forma independiente por sucursal.</p>
        
        <div class="table-responsive">
          <table class="table" id="table-sucursales">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th class="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="6" class="text-center">Cargando sucursales...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Crear/Editar Sucursal -->
      <div id="modal-sucursal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold" id="modal-sucursal-title">Nueva Sucursal</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-sucursal')">✕</button>
          </div>
          <div class="modal-body">
            <form id="form-sucursal">
              <input type="hidden" id="sucursal-id">
              <div class="form-group">
                <label class="form-label">Nombre de la Tienda *</label>
                <input type="text" id="sucursal-nombre" class="form-control" required placeholder="Ej: Tienda Principal">
              </div>
              <div class="form-group">
                <label class="form-label">Dirección</label>
                <input type="text" id="sucursal-direccion" class="form-control" placeholder="Dirección física">
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" id="sucursal-telefono" class="form-control" placeholder="Teléfono de contacto">
              </div>
              <div class="form-group" id="grupo-estado" style="display:none">
                <label class="form-label">Estado</label>
                <select id="sucursal-activo" class="form-control">
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
              <div class="flex justify-end gap" style="margin-top:1.5rem">
                <button type="button" class="btn btn-secondary" onclick="app.closeModal('modal-sucursal')">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    this.container.querySelector('#btn-nueva-sucursal').addEventListener('click', () => {
      document.getElementById('form-sucursal').reset();
      document.getElementById('sucursal-id').value = '';
      document.getElementById('modal-sucursal-title').textContent = 'Nueva Sucursal';
      document.getElementById('grupo-estado').style.display = 'none';
      app.openModal('modal-sucursal');
    });

    this.container.querySelector('#form-sucursal').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('sucursal-id').value;
      const data = {
        nombre: document.getElementById('sucursal-nombre').value,
        direccion: document.getElementById('sucursal-direccion').value,
        telefono: document.getElementById('sucursal-telefono').value,
        activo: document.getElementById('sucursal-activo').value === 'true'
      };

      try {
        if (id) {
          await api.put('/sucursales/' + id, data);
          app.showToast('Sucursal actualizada correctamente', 'success');
        } else {
          await api.post('/sucursales', data);
          app.showToast('Sucursal creada correctamente', 'success');
        }
        app.closeModal('modal-sucursal');
        
        // Recargar menú de sucursales en topbar y esta tabla
        await app.loadSucursales();
        this.load();
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });

    // Delegación de eventos para botones editar
    this.container.querySelector('#table-sucursales').addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-edit');
      if (btnEdit) {
        const id = btnEdit.dataset.id;
        this.editSucursal(id);
      }
    });
  },

  async load() {
    try {
      const res = await api.get('/sucursales');
      const sucursales = res.data || [];
      this.data = sucursales;
      const tbody = this.container.querySelector('#table-sucursales tbody');
      
      if (sucursales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay sucursales registradas</td></tr>';
        return;
      }

      tbody.innerHTML = sucursales.map(s => `
        <tr>
          <td>${s.id}</td>
          <td class="font-bold">${s.nombre}</td>
          <td>${s.direccion || '-'}</td>
          <td>${s.telefono || '-'}</td>
          <td><span class="badge ${s.activo ? 'badge-success' : 'badge-danger'}">${s.activo ? 'Activa' : 'Inactiva'}</span></td>
          <td class="text-right">
            <button class="btn-icon btn-secondary btn-edit" data-id="${s.id}" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      app.showToast('Error cargando sucursales', 'error');
    }
  },

  editSucursal(id) {
    const sucursal = this.data.find(s => s.id == id);
    if (!sucursal) return;

    document.getElementById('sucursal-id').value = sucursal.id;
    document.getElementById('sucursal-nombre').value = sucursal.nombre;
    document.getElementById('sucursal-direccion').value = sucursal.direccion || '';
    document.getElementById('sucursal-telefono').value = sucursal.telefono || '';
    document.getElementById('sucursal-activo').value = sucursal.activo;
    
    document.getElementById('modal-sucursal-title').textContent = 'Editar Sucursal';
    document.getElementById('grupo-estado').style.display = 'block';
    
    app.openModal('modal-sucursal');
  }
};
