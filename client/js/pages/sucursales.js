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
      <!-- Header -->
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="text-gold" style="margin: 0 0 0.25rem 0; font-size: 1.6rem;">Gestión de Sucursales</h2>
          <p class="text-muted" style="margin: 0; font-size: 0.875rem;">
            Administra tus tiendas físicas. El catálogo es compartido, pero el inventario es independiente por sucursal.
          </p>
        </div>
        <button class="btn btn-primary" id="btn-nueva-sucursal" style="white-space:nowrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" style="margin-right:6px;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nueva Sucursal
        </button>
      </div>

      <!-- Cards grid -->
      <div id="sucursales-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
        <!-- Cards inyectadas por load() -->
        <div class="text-muted text-center" style="grid-column:1/-1; padding:3rem 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:0.3;margin-bottom:1rem">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <p>Cargando sucursales...</p>
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
              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">Dirección</label>
                  <input type="text" id="sucursal-direccion" class="form-control" placeholder="Dirección física">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Teléfono</label>
                  <input type="text" id="sucursal-telefono" class="form-control" placeholder="Teléfono de contacto">
                </div>
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
                <button type="submit" class="btn btn-primary">Guardar Sucursal</button>
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
    this.container.querySelector('#sucursales-grid').addEventListener('click', (e) => {
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
      const grid = this.container.querySelector('#sucursales-grid');
      
      if (sucursales.length === 0) {
        grid.innerHTML = `
          <div class="text-muted text-center" style="grid-column:1/-1; padding:3rem 0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:0.3;margin-bottom:1rem">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <p>No hay sucursales registradas</p>
          </div>`;
        return;
      }

      grid.innerHTML = sucursales.map(s => `
        <div class="card" style="border: 1px solid var(--bg-secondary); border-radius: var(--border-radius-md); overflow: hidden; transition: box-shadow 0.2s;">
          <!-- Card Header con color de estado -->
          <div style="background: ${s.activo ? 'var(--accent-gold)' : 'var(--bg-secondary)'}; height: 5px;"></div>
          <div class="card-body" style="padding: 1.25rem;">
            <!-- Nombre + Badge -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 42px; height: 42px; border-radius: 10px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" stroke-width="2" width="22">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </div>
                <div>
                  <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">${s.nombre}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary);">ID #${s.id}</div>
                </div>
              </div>
              <span class="badge ${s.activo ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">
                ${s.activo ? '● Activa' : '○ Inactiva'}
              </span>
            </div>

            <!-- Info -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" style="flex-shrink:0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${s.direccion || '<em style="opacity:.5">Sin dirección registrada</em>'}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" style="flex-shrink:0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2.77h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l.72-.72a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.22 17.7"></path>
                </svg>
                <span>${s.telefono || '<em style="opacity:.5">Sin teléfono registrado</em>'}</span>
              </div>
            </div>

            <!-- Footer / Acciones -->
            <div style="border-top: 1px solid var(--bg-secondary); padding-top: 1rem; display: flex; justify-content: flex-end;">
              <button class="btn btn-secondary btn-edit" data-id="${s.id}" style="font-size: 0.8rem; padding: 0.4rem 1rem; display: flex; align-items: center; gap: 0.4rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Editar
              </button>
            </div>
          </div>
        </div>
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
