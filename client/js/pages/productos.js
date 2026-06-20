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
        <div class="card-header flex justify-between items-center flex-wrap gap-2">
          <h2 class="text-gold">Inventario de Productos</h2>
          <div class="flex gap-2 flex-wrap">
            <button class="btn btn-secondary btn-sm" onclick="window.prodDownloadTemplate()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Plantilla
            </button>
            <label class="btn btn-secondary btn-sm cursor-pointer" style="margin: 0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Importar
              <input type="file" id="prod-import-file" accept=".xlsx, .xls" style="display:none" onchange="window.prodImportExcel(event)">
            </label>
            <button class="btn btn-primary btn-sm" onclick="window.prodOpenModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Nuevo
            </button>
          </div>
        </div>
        
        <div class="card-body">
          <div class="mobile-filter-row" style="margin-bottom: 1rem">
            <div class="form-control flex items-center" style="padding:0; min-width:0">
              <input type="text" id="prod-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar por código o nombre...">
            </div>
            <select id="prod-filter-cat" class="form-control">
              <option value="">Todas las Categorías</option>
            </select>
            <select id="prod-filter-mat" class="form-control">
              <option value="">Todos los Materiales</option>
            </select>
          </div>

          <div class="table-responsive">
            <table class="data-table" id="prod-table">
              <thead>
                <tr>
                  <th>Código / Variantes</th>
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
        <div class="modal" style="max-width: 800px">
          <div class="modal-header">
            <h3 class="text-gold" id="prod-modal-title">Nuevo Producto</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-producto')">✕</button>
          </div>
          <div class="modal-body">
            <form id="prod-form">
              <input type="hidden" id="prod-id">
              
              <div class="form-row flex gap-4" id="prod-padre-row">
                <div class="form-group flex-1">
                  <label class="form-label">¿Es variante de otro producto? (Opcional)</label>
                  <select id="prod-padre" class="form-control">
                    <option value="">No, es un producto nuevo</option>
                  </select>
                </div>
              </div>

              <div class="form-row flex gap-4">
                <div class="form-group flex-1">
                  <label class="form-label">Código / SKU (Opcional)</label>
                  <input type="text" id="prod-codigo" class="form-control" placeholder="Autogenerado si está vacío">
                </div>
                <div class="form-group flex-1">
                  <label class="form-label" id="lbl-prod-nombre">Nombre del Producto *</label>
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

              <div class="mt-4 pt-4 border-t" id="prod-variantes-section" style="display:none; border-top: 1px solid var(--bg-secondary)">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="text-gold">Variantes del Producto</h4>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="window.prodAddVariant()">+ Agregar Variante</button>
                </div>
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Variante</th>
                        <th>Stock</th>
                        <th>Precio (Opcional)</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody id="prod-variantes-tbody">
                    </tbody>
                  </table>
                </div>
              </div>

            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-producto')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.prodSave()">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Generar Código de Barras -->
      <div id="modal-barcode" class="modal-overlay">
        <div class="modal" style="max-width: 400px">
          <div class="modal-header">
            <h3 class="text-gold">Imprimir Etiqueta</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-barcode')">✕</button>
          </div>
          <div class="modal-body text-center" id="barcode-print-area">
            <div style="padding: 1rem; background: white; border-radius: 8px; display: inline-block; margin-top: 1rem;">
              <svg id="barcode-svg"></svg>
            </div>
            <p class="text-muted mt-2" id="barcode-prod-name"></p>
            <p class="text-gold fw-bold" id="barcode-prod-price"></p>
          </div>
          <div class="modal-footer flex-col gap-2">
            <button class="btn btn-primary w-full" onclick="window.prodPrintBarcode()">🖨️ Imprimir</button>
          </div>
        </div>
      <div id="modal-edit-variant" class="modal-overlay">
        <div class="modal" style="max-width: 400px">
          <div class="modal-header">
            <h3 class="text-gold">Editar Variante</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-edit-variant')">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="edit-var-id">
            <div class="form-group">
              <label class="form-label">Nombre de Variante</label>
              <input type="text" id="edit-var-nombre" class="form-control">
            </div>
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">Stock Actual</label>
                <input type="number" id="edit-var-stock" class="form-control" min="0">
              </div>
              <div class="form-group flex-1">
                <label class="form-label">Precio (S/)</label>
                <input type="number" id="edit-var-precio" class="form-control" step="0.10" min="0">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-edit-variant')">Cancelar</button>
            <button class="btn btn-primary" onclick="window.prodSaveVariant()">Guardar Variante</button>
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
    
    const padreSelect = document.getElementById('prod-padre');
    if (padreSelect) {
      padreSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          document.getElementById('lbl-prod-nombre').textContent = 'Nombre de la Variante (Ej: Talla 6) *';
          document.getElementById('prod-categoria').disabled = true;
          document.getElementById('prod-material').disabled = true;
        } else {
          document.getElementById('lbl-prod-nombre').textContent = 'Nombre del Producto *';
          document.getElementById('prod-categoria').disabled = false;
          document.getElementById('prod-material').disabled = false;
        }
      });
    }
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
        const filterCat = document.getElementById('prod-filter-cat');
        const formCat = document.getElementById('prod-categoria');
        filterCat.innerHTML = '<option value="">Todas las Categorías</option>' + opts;
        formCat.innerHTML = '<option value="">-- Ninguna --</option>' + opts;
      }

      if (matRes.success) {
        this.materiales = matRes.data;
        const opts = this.materiales.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        const filterMat = document.getElementById('prod-filter-mat');
        const formMat = document.getElementById('prod-material');
        filterMat.innerHTML = '<option value="">Todos los Materiales</option>' + opts;
        formMat.innerHTML = '<option value="">-- Ninguno --</option>' + opts;
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

    tbody.innerHTML = data.map(p => {
      const isVariants = p.tiene_variantes;
      const codeHtml = isVariants 
        ? `<span class="badge badge-info flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> Variantes</span>` 
        : (p.codigo || '-');
      
      const priceStr = parseFloat(p.precio_venta).toFixed(2);
      
      return `
        <tr>
          <td class="text-muted">${codeHtml}</td>
          <td class="fw-bold">${p.nombre}</td>
          <td>${p.categoria_nombre || '-'}</td>
          <td>
            <span class="badge ${p.stock_actual <= p.stock_minimo ? 'badge-danger' : 'badge-success'}">
              ${p.stock_actual}
            </span>
          </td>
          <td class="fw-bold text-gold">S/ ${priceStr}</td>
          <td class="text-right flex justify-end gap-2">
            ${!isVariants ? `
            <button class="btn-icon btn-secondary" onclick="window.prodShowBarcode('${p.codigo || ''}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_venta})" title="Imprimir Etiqueta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M3 12h18M3 19h18"></path></svg>
            </button>
            ` : ''}
            <button class="btn-icon btn-secondary" onclick="window.prodEdit(${p.id})" title="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-icon btn-danger" onclick="window.prodDelete(${p.id})" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openModal(id = null) {
    const isEdit = id !== null;
    document.getElementById('prod-modal-title').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('prod-variantes-section').style.display = isEdit ? 'block' : 'none';
    document.getElementById('prod-variantes-tbody').innerHTML = '';
    
    if (isEdit) {
      document.getElementById('prod-padre-row').style.display = 'none';
      try {
        const res = await api.get(`/productos/${id}`);
        const p = res.data;
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-codigo').value = p.codigo || '';
        document.getElementById('prod-nombre').value = p.nombre;
        document.getElementById('prod-categoria').value = p.categoria_id || '';
        document.getElementById('prod-material').value = p.material_id || '';
        document.getElementById('prod-precio').value = parseFloat(p.precio_venta).toFixed(2);
        document.getElementById('prod-stock').value = p.stock_actual;
        document.getElementById('prod-minimo').value = p.stock_minimo;
        document.getElementById('prod-desc').value = p.descripcion || '';
        
        // Block fields if it has variants
        if (p.tiene_variantes) {
          document.getElementById('prod-precio').disabled = true;
          document.getElementById('prod-stock').disabled = true;
          document.getElementById('prod-codigo').disabled = true;
          
          // Render variants
          const tbody = document.getElementById('prod-variantes-tbody');
          if (p.variantes) {
            tbody.innerHTML = p.variantes.map(v => `
              <tr>
                <td>${v.sku}</td>
                <td>${v.nombre_variante}</td>
                <td>${v.stock_actual}</td>
                <td>S/ ${parseFloat(v.precio_venta || p.precio_venta).toFixed(2)}</td>
                <td style="display: flex; gap: 0.25rem;">
                  <button type="button" class="btn-icon btn-secondary" onclick="window.prodEditVariant(${v.id}, '${v.nombre_variante.replace(/'/g, "\\'")}', ${v.stock_actual}, ${v.precio_venta || p.precio_venta})" title="Editar Variante">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button type="button" class="btn-icon btn-secondary" onclick="window.prodShowBarcode('${v.sku}', '${v.nombre_variante.replace(/'/g, "\\'")}', ${v.precio_venta || p.precio_venta})" title="Imprimir Código">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M3 5h18M3 12h18M3 19h18"></path></svg>
                  </button>
                </td>
              </tr>
            `).join('');
          }
        } else {
          document.getElementById('prod-precio').disabled = false;
          document.getElementById('prod-stock').disabled = false;
          document.getElementById('prod-codigo').disabled = false;
        }
      } catch (err) {
        app.showToast('Error cargando producto', 'error');
      }
    } else {
      document.getElementById('prod-form').reset();
      document.getElementById('prod-id').value = '';
      document.getElementById('prod-precio').disabled = false;
      document.getElementById('prod-stock').disabled = false;
      document.getElementById('prod-codigo').disabled = false;
      
      document.getElementById('prod-padre-row').style.display = 'flex';
      const padreSelect = document.getElementById('prod-padre');
      padreSelect.innerHTML = '<option value="">No, es un producto nuevo</option>' + 
        (this.productos || []).map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        
      // Reset labels and states
      document.getElementById('lbl-prod-nombre').textContent = 'Nombre del Producto *';
      document.getElementById('prod-categoria').disabled = false;
      document.getElementById('prod-material').disabled = false;
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
        const padreId = document.getElementById('prod-padre').value;
        if (padreId) {
          // It's a new variant
          const varPayload = {
            producto_id: padreId,
            sku: payload.codigo,
            nombre_variante: payload.nombre,
            precio_venta: payload.precio_venta,
            stock_actual: payload.stock_actual,
            stock_minimo: payload.stock_minimo
          };
          await api.post('/variantes', varPayload);
          app.showToast('Variante agregada', 'success');
        } else {
          // It's a new product
          await api.post('/productos', payload);
          app.showToast('Producto creado', 'success');
        }
      }
      app.closeModal('modal-producto');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  async deleteProd(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      await api.delete(`/productos/${id}`);
      app.showToast('Producto eliminado', 'success');
      this.loadData();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  editVariant(id, currentName, currentStock, currentPrice) {
    document.getElementById('edit-var-id').value = id;
    document.getElementById('edit-var-nombre').value = currentName;
    document.getElementById('edit-var-stock').value = currentStock;
    document.getElementById('edit-var-precio').value = currentPrice;
    app.openModal('modal-edit-variant');
  },

  async saveVariant() {
    const id = document.getElementById('edit-var-id').value;
    const nombre = document.getElementById('edit-var-nombre').value;
    const stock = document.getElementById('edit-var-stock').value;
    const precio = document.getElementById('edit-var-precio').value;

    if (!nombre) return app.showToast('El nombre de la variante es requerido', 'warning');

    try {
      await api.put(`/variantes/${id}`, {
        nombre_variante: nombre,
        stock_actual: parseInt(stock) || 0,
        precio_venta: parseFloat(precio) || 0
      });
      app.showToast('Variante actualizada correctamente', 'success');
      app.closeModal('modal-edit-variant');
      // Reload products list to reflect changes
      this.loadData();
      // Re-open the modal with updated data
      const prodId = document.getElementById('prod-id').value;
      if (prodId) {
        this.openModal(prodId);
      }
    } catch (err) {
      app.showToast(err.message || 'Error al actualizar', 'error');
    }
  },

  downloadTemplate() {
    window.location.href = '/plantillas/inventario_template.xlsx';
  },

  async importExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    app.showToast('Importando...', 'info');
    try {
      const res = await api.post('/productos/import-excel', formData);
      app.showToast(res.message || 'Importación exitosa', 'success');
      this.loadData();
    } catch (err) {
      app.showToast(err.message || 'Error en importación', 'error');
    }
    e.target.value = ''; // reset
  },

  showBarcode(codigo, nombre, precio) {
    if (!codigo) return app.showToast('Producto sin código', 'warning');
    
    document.getElementById('barcode-prod-name').textContent = nombre;
    document.getElementById('barcode-prod-price').textContent = `S/ ${parseFloat(precio).toFixed(2)}`;
    
    // Generate barcode SVG
    try {
      JsBarcode("#barcode-svg", codigo, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 60,
        displayValue: true
      });
      app.openModal('modal-barcode');
    } catch (err) {
      console.error(err);
      app.showToast('Error generando código de barras', 'error');
    }
  },

  printBarcode() {
    const printArea = document.getElementById('barcode-print-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=400');
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir Etiqueta</title>
          <style>
            body { font-family: sans-serif; text-align: center; margin: 0; padding: 20px; }
            svg { max-width: 100%; height: auto; }
            .price { font-size: 20px; font-weight: bold; margin-top: 10px; }
            @media print {
              @page { margin: 0; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${printArea}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  },

  load() {
    window.prodOpenModal = this.openModal.bind(this);
    window.prodSave = this.save.bind(this);
    window.prodEdit = this.openModal.bind(this);
    window.prodDelete = this.deleteProd.bind(this);
    window.prodDownloadTemplate = this.downloadTemplate.bind(this);
    window.prodImportExcel = this.importExcel.bind(this);
    window.prodShowBarcode = this.showBarcode.bind(this);
    window.prodPrintBarcode = this.printBarcode.bind(this);
    window.prodEditVariant = this.editVariant.bind(this);
    window.prodSaveVariant = this.saveVariant.bind(this);
    window.prodAddVariant = () => {
      const currentParentId = document.getElementById('prod-id').value;
      app.closeModal('modal-producto');
      this.openModal(null); // Open as new
      setTimeout(() => {
        const padreSelect = document.getElementById('prod-padre');
        if (padreSelect) {
          padreSelect.value = currentParentId;
          padreSelect.dispatchEvent(new Event('change'));
        }
      }, 100);
    };
  }
};
