import { api } from '../api.js';

export default {
  container: null,
  productos: [],
  categorias: [],
  materiales: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h2 class="text-gold">Productos</h2>
          <button class="btn btn-primary" onclick="window.prodOpenModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Producto
          </button>
        </div>
        
        <div class="card-body">
          <div class="flex flex-wrap gap-4" style="margin-bottom: 1.5rem">
            <div class="form-control flex items-center flex-1" style="min-width: 200px; padding:0">
              <input type="text" id="prod-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar por código o nombre...">
            </div>
            <select id="prod-filter-cat" class="form-control" style="width:auto">
              <option value="">Todas las Categorías</option>
            </select>
            <select id="prod-filter-mat" class="form-control" style="width:auto">
              <option value="">Todos los Materiales</option>
            </select>
          </div>

          <div class="table-container">
            <table class="data-table" id="prod-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Precio</th>
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

      <!-- Modal Crear/Editar -->
      <div id="modal-producto" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold" id="prod-modal-title">Nuevo Producto</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-producto')">✕</button>
          </div>
          <div class="modal-body">
            <form id="prod-form">
              <input type="hidden" id="prod-id">
              
              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">Código (Opcional)</label>
                  <input type="text" id="prod-codigo" class="form-control" placeholder="Autogenerado si está vacío">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Nombre *</label>
                  <input type="text" id="prod-nombre" class="form-control" required>
                </div>
              </div>

              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">Categoría</label>
                  <select id="prod-categoria" class="form-control"></select>
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Material</label>
                  <select id="prod-material" class="form-control"></select>
                </div>
              </div>

              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">Precio Venta (S/) *</label>
                  <input type="number" id="prod-precio" class="form-control" step="0.01" min="0" required>
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Stock Actual</label>
                  <input type="number" id="prod-stock" class="form-control" value="0" min="0">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label">Stock Mínimo</label>
                  <input type="number" id="prod-minimo" class="form-control" value="1" min="0">
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Descripción</label>
                <textarea id="prod-desc" class="form-control" rows="2"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-producto')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.prodSave()">Guardar</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    const search = document.getElementById('prod-search');
    const cat = document.getElementById('prod-filter-cat');
    const mat = document.getElementById('prod-filter-mat');

    search.addEventListener('input', () => this.filterTable());
    cat.addEventListener('change', () => this.filterTable());
    mat.addEventListener('change', () => this.filterTable());
  },

  async loadData() {
    try {
      const [prodRes, catRes, matRes] = await Promise.all([
        api.get('/productos', { estado: 'activo' }),
        api.get('/categorias'),
        api.get('/materiales')
      ]);

      if (prodRes.success) this.productos = prodRes.data;
      
      if (catRes.success) {
        this.categorias = catRes.data;
        const opts = this.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        document.getElementById('prod-filter-cat').innerHTML += opts;
        document.getElementById('prod-categoria').innerHTML = '<option value="">-- Ninguna --</option>' + opts;
      }

      if (matRes.success) {
        this.materiales = matRes.data;
        const opts = this.materiales.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        document.getElementById('prod-filter-mat').innerHTML += opts;
        document.getElementById('prod-material').innerHTML = '<option value="">-- Ninguno --</option>' + opts;
      }

      this.renderTable(this.productos);
    } catch (err) {
      app.showToast('Error cargando productos', 'error');
    }
  },

  filterTable() {
    const term = document.getElementById('prod-search').value.toLowerCase();
    const catId = document.getElementById('prod-filter-cat').value;
    const matId = document.getElementById('prod-filter-mat').value;

    const filtered = this.productos.filter(p => {
      const matchTerm = p.nombre.toLowerCase().includes(term) || (p.codigo && p.codigo.toLowerCase().includes(term));
      const matchCat = catId ? p.categoria_id == catId : true;
      const matchMat = matId ? p.material_id == matId : true;
      return matchTerm && matchCat && matchMat;
    });

    this.renderTable(filtered);
  },

  renderTable(data) {
    const tbody = document.querySelector('#prod-table tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se encontraron productos</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => `
      <tr>
        <td class="text-muted">${p.codigo || '-'}</td>
        <td class="fw-bold">${p.nombre}</td>
        <td>${p.categoria_nombre || '-'}</td>
        <td>
          <span class="badge ${p.stock_actual <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">
            ${p.stock_actual}
          </span>
        </td>
        <td class="fw-bold text-gold">S/ ${parseFloat(p.precio_venta).toFixed(2)}</td>
        <td class="text-right">
          <button class="btn-icon btn-secondary" onclick="window.prodEdit(${p.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon btn-danger" onclick="window.prodDelete(${p.id})" title="Eliminar" style="margin-left:0.5rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `).join('');
  },

  openModal(id = null) {
    const isEdit = id !== null;
    document.getElementById('prod-modal-title').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';
    
    if (isEdit) {
      const p = this.productos.find(x => x.id === id);
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-codigo').value = p.codigo || '';
      document.getElementById('prod-nombre').value = p.nombre;
      document.getElementById('prod-categoria').value = p.categoria_id || '';
      document.getElementById('prod-material').value = p.material_id || '';
      document.getElementById('prod-precio').value = parseFloat(p.precio_venta).toFixed(2);
      document.getElementById('prod-stock').value = p.stock_actual;
      document.getElementById('prod-minimo').value = p.stock_minimo;
      document.getElementById('prod-desc').value = p.descripcion || '';
    } else {
      document.getElementById('prod-form').reset();
      document.getElementById('prod-id').value = '';
    }

    app.openModal('modal-producto');
  },

  async save() {
    const id = document.getElementById('prod-id').value;
    const isEdit = !!id;
    
    const payload = {
      codigo: document.getElementById('prod-codigo').value || undefined,
      nombre: document.getElementById('prod-nombre').value,
      categoria_id: document.getElementById('prod-categoria').value || null,
      material_id: document.getElementById('prod-material').value || null,
      precio_venta: document.getElementById('prod-precio').value,
      stock_actual: document.getElementById('prod-stock').value,
      stock_minimo: document.getElementById('prod-minimo').value,
      descripcion: document.getElementById('prod-desc').value
    };

    if (!payload.nombre || !payload.precio_venta) {
      return app.showToast('Nombre y Precio son obligatorios', 'error');
    }

    try {
      if (isEdit) {
        await api.put(`/productos/${id}`, payload);
        app.showToast('Producto actualizado', 'success');
      } else {
        await api.post('/productos', payload);
        app.showToast('Producto creado', 'success');
      }
      app.closeModal('modal-producto');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async deleteProd(id) {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
      await api.del(`/productos/${id}`);
      app.showToast('Producto eliminado', 'success');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  load() {
    window.prodOpenModal = this.openModal.bind(this);
    window.prodSave = this.save.bind(this);
    window.prodEdit = this.openModal.bind(this);
    window.prodDelete = this.deleteProd.bind(this);
  }
};
