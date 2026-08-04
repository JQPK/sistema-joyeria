import { api } from '../api.js';
import { auth } from '../auth.js';

export default {
  container: null,

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="text-gold">Configuración</h2>
        </div>
        
        <div class="card-body">
          <form id="config-form">
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">Nombre de la Empresa</label>
                <input type="text" id="conf-nombre" class="form-control" required>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">RUC</label>
                <input type="text" id="conf-ruc" class="form-control">
              </div>
            </div>

            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">Dirección</label>
                <input type="text" id="conf-dir" class="form-control">
              </div>
              <div class="form-group flex-1">
                <label class="form-label">Teléfono</label>
                <input type="text" id="conf-tel" class="form-control">
              </div>
            </div>

            <h3 class="text-gold" style="margin: 2rem 0 1rem; border-bottom: 1px solid var(--bg-secondary); padding-bottom: 0.5rem">
              Comprobantes
            </h3>
            
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">Serie Boleta</label>
                <input type="text" id="conf-sboleta" class="form-control" required>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">Serie Factura</label>
                <input type="text" id="conf-sfactura" class="form-control" required>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Mensaje en Ticket</label>
              <input type="text" id="conf-mensaje" class="form-control">
            </div>

            <h3 class="text-gold" style="margin: 2rem 0 1rem; border-bottom: 1px solid var(--bg-secondary); padding-bottom: 0.5rem">
              Hardware (Impresora Térmica WiFi)
            </h3>

            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">IP Impresora</label>
                <input type="text" id="conf-print-ip" class="form-control" placeholder="Ej: 192.168.1.100">
              </div>
              <div class="form-group flex-1">
                <label class="form-label">Puerto</label>
                <input type="number" id="conf-print-port" class="form-control" value="9100">
              </div>
            </div>

            <div class="flex justify-end mt-4">
              <button type="button" class="btn btn-primary" onclick="window.confSave()">Guardar Configuración</button>
            </div>
          </form>

          <h3 class="text-gold" style="margin: 2rem 0 1rem; border-bottom: 1px solid var(--bg-secondary); padding-bottom: 0.5rem">
            Gestión de Categorías
          </h3>
          <div class="flex gap-2">
            <input type="text" id="new-cat-name" class="form-control flex-1" placeholder="Nueva Categoría">
            <button class="btn btn-secondary" onclick="window.confAddCat()">Agregar</button>
          </div>
          <div id="cat-list" class="flex flex-wrap gap-2 mt-4" style="margin-top: 1rem">Cargando...</div>

          <h3 class="text-gold" style="margin: 2rem 0 1rem; border-bottom: 1px solid var(--bg-secondary); padding-bottom: 0.5rem">
            Gestión de Materiales
          </h3>
          <div class="flex gap-2">
            <input type="text" id="new-mat-name" class="form-control flex-1" placeholder="Nuevo Material">
            <button class="btn btn-secondary" onclick="window.confAddMat()">Agregar</button>
          </div>
          <div id="mat-list" class="flex flex-wrap gap-2 mt-4" style="margin-top: 1rem">Cargando...</div>

        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const [confRes, catRes, matRes] = await Promise.all([
        api.get('/config'),
        api.get('/categorias'),
        api.get('/materiales')
      ]);

      if (confRes.success) {
        const c = confRes.data;
        document.getElementById('conf-nombre').value = c.nombre_empresa;
        document.getElementById('conf-ruc').value = c.ruc || '';
        document.getElementById('conf-dir').value = c.direccion || '';
        document.getElementById('conf-tel').value = c.telefono || '';
        document.getElementById('conf-sboleta').value = c.serie_boleta;
        document.getElementById('conf-sfactura').value = c.serie_factura;
        document.getElementById('conf-mensaje').value = c.mensaje_ticket || '';
        document.getElementById('conf-print-ip').value = c.printer_ip || '';
        document.getElementById('conf-print-port').value = c.printer_port || 9100;
      }

      if (catRes.success) {
        this.renderTags('cat-list', catRes.data, 'window.confDelCat');
      }

      if (matRes.success) {
        this.renderTags('mat-list', matRes.data, 'window.confDelMat');
      }
    } catch (err) {
      app.showToast('Error cargando configuración', 'error');
    }
  },

  renderTags(containerId, items, delFunction) {
    const container = document.getElementById(containerId);
    if (!items.length) {
      container.innerHTML = '<span class="text-muted">No hay registros</span>';
      return;
    }

    container.innerHTML = items.map(i => `
      <div class="badge" style="display:flex; align-items:center; gap:0.5rem; background:var(--bg-secondary); color:var(--text-primary); font-size:0.9rem; padding:0.5rem 1rem">
        ${i.nombre}
        <button style="border:none; background:none; cursor:pointer; color:var(--color-danger); display:flex; align-items:center" onclick="${delFunction}(${i.id})">✕</button>
      </div>
    `).join('');
  },

  async saveConfig() {
    const payload = {
      nombre_empresa: document.getElementById('conf-nombre').value,
      ruc: document.getElementById('conf-ruc').value,
      direccion: document.getElementById('conf-dir').value,
      telefono: document.getElementById('conf-tel').value,
      serie_boleta: document.getElementById('conf-sboleta').value,
      serie_factura: document.getElementById('conf-sfactura').value,
      mensaje_ticket: document.getElementById('conf-mensaje').value,
      printer_ip: document.getElementById('conf-print-ip').value,
      printer_port: document.getElementById('conf-print-port').value,
    };

    try {
      await api.put('/config', payload);
      app.showToast('Configuración guardada', 'success');
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async addCat() {
    const nombre = document.getElementById('new-cat-name').value;
    if (!nombre) return;
    try {
      await api.post('/categorias', { nombre });
      document.getElementById('new-cat-name').value = '';
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async delCat(id) {
    if(!confirm('¿Eliminar esta categoría?')) return;
    try {
      await api.del(`/categorias/${id}`);
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async addMat() {
    const nombre = document.getElementById('new-mat-name').value;
    if (!nombre) return;
    try {
      await api.post('/materiales', { nombre });
      document.getElementById('new-mat-name').value = '';
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async delMat(id) {
    if(!confirm('¿Eliminar este material?')) return;
    try {
      await api.del(`/materiales/${id}`);
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  load() {
    window.confSave = this.saveConfig.bind(this);
    window.confAddCat = this.addCat.bind(this);
    window.confDelCat = this.delCat.bind(this);
    window.confAddMat = this.addMat.bind(this);
    window.confDelMat = this.delMat.bind(this);
  }
};
