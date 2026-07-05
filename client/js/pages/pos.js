import { api, API_URL } from '../api.js';
import { scanner } from '../scanner.js';

export default {
  container: null,
  cart: [],
  products: [],
  categories: [],
  activeCategory: null,
  searchTimeout: null,

  async init(container) {
    this.container = container;
    this.container.innerHTML = `
      <div class="pos-layout">
        <!-- Products Section -->
        <div class="pos-products">
          <div class="flex gap-2">
            <div class="form-control flex-1 flex items-center" style="padding: 0; position: relative">
              <input type="text" id="pos-search" class="search-input w-full" style="border:none; height:100%" placeholder="Buscar producto o escanear código...">
            </div>
            <button id="btn-pos-scan" class="btn btn-secondary btn-icon" title="Escanear con cámara">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M9 12h6"></path></svg>
            </button>
          </div>
          
          <div class="filter-scroll" id="pos-categories">
            <!-- Categories injected here -->
          </div>

          <div class="product-grid" id="pos-product-grid">
            <!-- Products injected here -->
          </div>
        </div>

        <!-- Cart Section -->
        <div class="pos-cart" id="pos-cart-panel">
          <div class="card-header" style="background: var(--bg-primary)">
            <h3 style="font-size: 1.1rem; display:flex; align-items:center; gap:0.5rem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              Pedido Actual
            </h3>
            <button id="btn-close-cart" class="btn-icon btn-secondary" style="display:none">✕</button>
          </div>
          
          <div class="cart-items" id="pos-cart-items">
            <div class="empty-state text-center text-muted" style="margin-top: 2rem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:0.5;margin-bottom:1rem"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <p>El carrito está vacío</p>
            </div>
          </div>
          
          <div class="cart-summary">
            <div class="summary-row">
              <span class="text-muted">Subtotal</span>
              <span class="fw-bold" id="pos-subtotal">S/ 0.00</span>
            </div>
            <div class="summary-row">
              <span class="text-muted">Descuento</span>
              <span class="text-danger fw-bold" id="pos-descuento">- S/ 0.00</span>
            </div>
            <div class="summary-row summary-total">
              <span>Total</span>
              <span class="text-gold" id="pos-total">S/ 0.00</span>
            </div>
            <button id="btn-checkout" class="btn btn-primary w-full" style="margin-top: 1rem" disabled>
              Cobrar
            </button>
          </div>
        </div>
      </div>
      
      <!-- Mobile Cart Toggle Button -->
      <button id="btn-toggle-cart" class="btn btn-primary btn-fab cart-toggle-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <span id="mobile-cart-count" class="badge bg-white text-primary" style="margin-left:0.5rem">0</span>
      </button>

      <!-- Checkout Modal -->
      <div id="modal-checkout" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3 class="text-gold">Completar Venta</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-checkout')">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Cliente (Opcional)</label>
              <select id="checkout-cliente" class="form-control">
                <option value="">Cliente General</option>
              </select>
            </div>
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">Comprobante</label>
                <select id="checkout-tipo" class="form-control">
                  <option value="boleta">Boleta</option>
                  <option value="factura">Factura</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">Método de Pago</label>
                <select id="checkout-pago" class="form-control">
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta (POS)</option>
                  <option value="transferencia">Transferencia / Yape</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">Descuento Global Adicional (S/)</label>
              <input type="number" id="checkout-descuento-manual" class="form-control" placeholder="Ej. 6.00" min="0" step="0.10" value="0.00" oninput="window.posUpdateTotalCheckout()">
            </div>
            <div class="card" style="background: var(--bg-secondary); margin-top: 1rem">
              <div class="card-body flex justify-between items-center">
                <span style="font-size: 1.2rem; font-weight: 600">Total a Cobrar:</span>
                <span id="checkout-total-display" style="font-size: 1.5rem; font-weight: 700; color: var(--accent-gold-dark)">S/ 0.00</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="app.closeModal('modal-checkout')">Cancelar</button>
            <button id="btn-confirm-checkout" class="btn btn-primary">Confirmar Venta</button>
          </div>
        </div>
      </div>

      <!-- Modal Variantes -->
      <div id="modal-variantes" class="modal-overlay">
        <div class="modal" style="max-width: 500px">
          <div class="modal-header">
            <h3 class="text-gold" id="pos-variant-title">Seleccionar Variante</h3>
            <button class="btn-icon btn-secondary" onclick="app.closeModal('modal-variantes')">✕</button>
          </div>
          <div class="modal-body">
            <div id="pos-variants-list" class="flex flex-col gap-2">
              <div class="text-center text-muted">Cargando variantes...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Venta Exitosa -->
      <div id="modal-venta-exitosa" class="modal-overlay">
        <div class="modal" style="max-width: 400px; text-align: center">
          <div class="modal-header" style="justify-content: center; border-bottom: none">
            <h3 class="text-success" style="font-size: 1.5rem">¡Venta Exitosa!</h3>
          </div>
          <div class="modal-body">
            <div style="margin-bottom: 1.5rem">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2" style="width: 64px; height: 64px; margin: 0 auto"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <p id="venta-exitosa-nro" class="text-muted mb-4"></p>
            <div class="flex-col gap-2">
              <button class="btn btn-primary w-full" id="btn-print-ticket">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" style="vertical-align: middle; margin-right: 8px"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir Ticket
              </button>
              
              <div style="margin-top: 1rem; text-align: left">
                <label class="form-label" style="font-size: 0.85rem">Enviar por WhatsApp al Número:</label>
                <div class="flex gap-2">
                  <input type="text" id="wa-phone-input" class="form-control" placeholder="Ej. 987654321" style="flex: 1">
                  <button class="btn btn-secondary" id="btn-whatsapp-ticket" style="color: #25D366; border-color: #25D366; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" style="vertical-align: middle; margin-right: 4px"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Enviar
                  </button>
                </div>
              </div>

              <button class="btn btn-secondary w-full" style="margin-top: 1.5rem" onclick="window.posNewSale()">
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    // Search
    const searchInput = document.getElementById('pos-search');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.filterProducts(e.target.value);
      }, 300);
    });

    // Camera scanner button
    const scanBtn = document.getElementById('btn-pos-scan');
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        scanner.open((code) => {
          this.handleScannedCode(code);
        });
      });
    }

    // Hardware barcode gun detection on search input
    scanner.initGunDetection(searchInput, (code) => {
      this.handleScannedCode(code);
    });

    // Mobile cart toggle
    const toggleBtn = document.getElementById('btn-toggle-cart');
    const closeBtn = document.getElementById('btn-close-cart');
    const cartPanel = document.getElementById('pos-cart-panel');
    
    if (toggleBtn && cartPanel) {
      toggleBtn.addEventListener('click', () => {
        cartPanel.classList.add('active');
        closeBtn.style.display = 'block';
      });
    }
    if (closeBtn && cartPanel) {
      closeBtn.addEventListener('click', () => {
        cartPanel.classList.remove('active');
        closeBtn.style.display = 'none';
      });
    }

    // Checkout
    document.getElementById('btn-checkout').addEventListener('click', () => {
      document.getElementById('checkout-descuento-manual').value = '0.00';
      document.getElementById('checkout-total-display').textContent = `S/ ${this.getTotal().toFixed(2)}`;
      app.openModal('modal-checkout');
    });

    // Confirm Sale
    document.getElementById('btn-confirm-checkout').addEventListener('click', async () => {
      await this.processSale();
    });
  },

  async handleScannedCode(code) {
    document.getElementById('pos-search').value = '';
    this.filterProducts('');
    
    try {
      const res = await api.get(`/productos/sku/${code}`);
      if (res.success) {
        if (res.type === 'product' && res.data.tiene_variantes) {
          // It's a base product that has variants, open variant selector
          this.addToCart(res.data.id);
        } else {
          // Direct add (either simple product or specific variant)
          this.addSpecificItemToCart(res.data, res.type);
          app.showToast(`Agregado: ${res.data.nombre}`, 'success');
        }
      } else {
        app.showToast(`Código "${code}" no encontrado`, 'warning');
      }
    } catch (err) {
      app.showToast(`Código "${code}" no encontrado`, 'warning');
    }
  },

  async loadData() {
    try {
      const [catRes, prodRes, cliRes] = await Promise.all([
        api.get('/categorias'),
        api.get('/productos', { estado: 'activo' }),
        api.get('/clientes')
      ]);

      if (catRes.success) this.categories = catRes.data;
      if (prodRes.success) this.products = prodRes.data;
      if (cliRes.success) {
        const select = document.getElementById('checkout-cliente');
        select.innerHTML = '<option value="">Cliente General</option>'; // reset
        cliRes.data.forEach(c => {
          select.innerHTML += `<option value="${c.id}">${c.nombre} ${c.dni_ruc ? `(${c.dni_ruc})` : ''}</option>`;
        });
      }

      this.renderCategories();
      this.renderProducts();
    } catch (err) {
      app.showToast('Error cargando datos del POS', 'error');
    }
  },

  renderCategories() {
    const container = document.getElementById('pos-categories');
    let html = `<button class="filter-chip ${!this.activeCategory ? 'active' : ''}" data-id="">Todos</button>`;
    
    this.categories.forEach(c => {
      html += `<button class="filter-chip ${this.activeCategory == c.id ? 'active' : ''}" data-id="${c.id}">${c.nombre}</button>`;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeCategory = e.target.dataset.id || null;
        this.renderProducts();
      });
    });
  },

  filterProducts(term) {
    term = term.toLowerCase();
    this.renderProducts(term);
  },

  renderProducts(searchTerm = '') {
    const container = document.getElementById('pos-product-grid');
    let filtered = this.products.filter(p => p.stock_actual > 0);
    
    if (this.activeCategory) {
      filtered = filtered.filter(p => p.categoria_id == this.activeCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => {
        const matchBase = p.nombre.toLowerCase().includes(searchTerm) || (p.codigo && p.codigo.toLowerCase().includes(searchTerm));
        let matchVar = false;
        if (p.tiene_variantes && p.variantes) {
          matchVar = p.variantes.some(v => 
            v.sku.toLowerCase().includes(searchTerm) || 
            v.nombre_variante.toLowerCase().includes(searchTerm)
          );
        }
        return matchBase || matchVar;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="text-muted w-full" style="grid-column: 1/-1; padding: 2rem; text-align: center">No se encontraron productos</div>';
      return;
    }

    container.innerHTML = filtered.map(p => `
      <div class="product-card" onclick="window.posAddToCart(${p.id})">
        ${p.descuento_porcentaje > 0 ? `<div class="badge badge-danger" style="position:absolute; top:8px; right:8px; z-index:2">-${parseFloat(p.descuento_porcentaje)}%</div>` : ''}
        ${p.tiene_variantes ? `<div class="badge badge-info" style="position:absolute; top:8px; left:8px; z-index:2">Variantes</div>` : ''}
        <div class="product-img">
          ${p.imagen_path ? `<img src="${p.imagen_path}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : 
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:40px;height:40px;margin-top:20px;color:var(--text-secondary)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`}
        </div>
        <div class="product-name" title="${p.nombre}">${p.nombre.length > 20 ? p.nombre.substring(0, 20)+'...' : p.nombre}</div>
        <div class="product-stock text-muted">Stock: ${p.stock_actual}</div>
        <div class="product-price">S/ ${parseFloat(p.precio_venta).toFixed(2)}</div>
      </div>
    `).join('');
  },

  async addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (product.tiene_variantes) {
      // Show variants modal
      document.getElementById('pos-variant-title').textContent = product.nombre;
      const list = document.getElementById('pos-variants-list');
      list.innerHTML = '<div class="text-center text-muted">Cargando...</div>';
      app.openModal('modal-variantes');

      try {
        const res = await api.get(`/productos/${productId}`);
        if (res.success && res.data.variantes) {
          const vars = res.data.variantes.filter(v => v.stock_actual > 0);
          if (vars.length === 0) {
            list.innerHTML = '<div class="text-center text-danger">No hay stock disponible para ninguna variante.</div>';
            return;
          }
          list.innerHTML = vars.map(v => {
            const price = parseFloat(v.precio_venta || product.precio_venta).toFixed(2);
            return `
              <div class="card card-body flex justify-between items-center cursor-pointer hover:bg-secondary" 
                   style="padding:0.75rem; border:1px solid var(--bg-secondary)"
                   onclick="window.posSelectVariant(${product.id}, ${v.id}, '${v.nombre_variante.replace(/'/g, "\\'")}', ${price}, ${v.stock_actual})">
                <div>
                  <div class="fw-bold">${v.nombre_variante}</div>
                  <div class="text-muted" style="font-size:0.8rem">SKU: ${v.sku} | Stock: ${v.stock_actual}</div>
                </div>
                <div class="fw-bold text-gold">S/ ${price}</div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        list.innerHTML = '<div class="text-center text-danger">Error cargando variantes</div>';
      }
      return;
    }

    // Direct add (no variants)
    this.addSpecificItemToCart(product, 'product');
  },

  addSpecificItemToCart(item, type) {
    // item is either a Product from this.products or a Variant structure
    const cartId = type === 'variant' ? `VAR-${item.variant_id}` : `PROD-${item.id}`;

    // Block products with no stock
    if (item.stock_actual <= 0) {
      app.showToast(`Sin stock disponible: ${item.nombre}`, 'error');
      return;
    }
    
    const existing = this.cart.find(i => i.cart_id === cartId);
    
    if (existing) {
      if (existing.cantidad < item.stock_actual) {
        existing.cantidad++;
        existing.subtotal_item = existing.cantidad * (existing.precio_unitario - existing.descuento_item);
      } else {
        app.showToast('Stock máximo alcanzado', 'warning');
      }
    } else {
      const precio = parseFloat(item.precio_venta);
      const desc = parseFloat(item.descuento_porcentaje || 0);
      const descuentoItem = desc > 0 ? (precio * desc / 100) : 0;
      const precioFinal = precio - descuentoItem;
      
      this.cart.push({
        cart_id: cartId,
        producto_id: item.id, // always base product ID for the DB
        variante_id: type === 'variant' ? item.variant_id : null,
        nombre: item.nombre,
        cantidad: 1,
        precio_unitario: precio,
        descuento_item: descuentoItem,
        subtotal_item: precioFinal,
        stock_max: item.stock_actual
      });
    }
    
    this.renderCart();
  },

  selectVariant(productId, variantId, variantName, price, stock) {
    const product = this.products.find(p => p.id === productId);
    this.addSpecificItemToCart({
      id: productId,
      variant_id: variantId,
      nombre: `${product.nombre} - ${variantName}`,
      precio_venta: price,
      stock_actual: stock,
      descuento_porcentaje: product.descuento_porcentaje
    }, 'variant');
    
    app.closeModal('modal-variantes');
    app.showToast(`Agregado: ${variantName}`, 'success');
  },

  updateQuantity(cartId, delta) {
    const item = this.cart.find(i => i.cart_id === cartId);
    if (!item) return;

    item.cantidad += delta;
    if (item.cantidad <= 0) {
      this.cart = this.cart.filter(i => i.cart_id !== cartId);
    } else if (item.cantidad > item.stock_max) {
      item.cantidad = item.stock_max;
      app.showToast('Stock máximo alcanzado', 'warning');
    } else {
      item.subtotal_item = item.cantidad * (item.precio_unitario - item.descuento_item);
    }
    this.renderCart();
  },

  getSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  },

  getDescuentoTotal() {
    return this.cart.reduce((sum, item) => sum + (item.descuento_item * item.cantidad), 0);
  },

  getTotal() {
    return this.cart.reduce((sum, item) => sum + item.subtotal_item, 0);
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    const btnCheckout = document.getElementById('btn-checkout');
    
    // Update mobile counter
    const mobileCount = document.getElementById('mobile-cart-count');
    if (mobileCount) {
      const totalItems = this.cart.reduce((s, i) => s + i.cantidad, 0);
      mobileCount.textContent = totalItems;
      mobileCount.style.display = totalItems > 0 ? 'inline-block' : 'none';
    }

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center text-muted" style="margin-top: 2rem">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="width:48px;height:48px;opacity:0.5;margin-bottom:1rem"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <p>El carrito está vacío</p>
        </div>
      `;
      btnCheckout.disabled = true;
      document.getElementById('pos-subtotal').textContent = 'S/ 0.00';
      document.getElementById('pos-descuento').textContent = '- S/ 0.00';
      document.getElementById('pos-total').textContent = 'S/ 0.00';
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-title" title="${item.nombre}">${item.nombre}</div>
          <div class="text-muted" style="font-size: 0.8rem">S/ ${item.precio_unitario.toFixed(2)} c/u</div>
          ${item.descuento_item > 0 ? `<div class="badge badge-danger mt-1">Desc: S/ ${item.descuento_item.toFixed(2)}</div>` : ''}
        </div>
        <div class="flex-col items-center gap-2">
          <div class="cart-item-price">S/ ${item.subtotal_item.toFixed(2)}</div>
          <div class="cart-controls">
            <button onclick="window.posUpdateQty('${item.cart_id}', -1)">-</button>
            <span style="min-width:20px;text-align:center">${item.cantidad}</span>
            <button onclick="window.posUpdateQty('${item.cart_id}', 1)">+</button>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('pos-subtotal').textContent = `S/ ${this.getSubtotal().toFixed(2)}`;
    document.getElementById('pos-descuento').textContent = `- S/ ${this.getDescuentoTotal().toFixed(2)}`;
    document.getElementById('pos-total').textContent = `S/ ${this.getTotal().toFixed(2)}`;
    btnCheckout.disabled = false;
  },

  async processSale() {
    const btn = document.getElementById('btn-confirm-checkout');
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
      // The API endpoint needs to support variante_id if applicable, but we mapped it back to producto_id
      // Let's pass the cart items directly.
      const descManualInput = document.getElementById('checkout-descuento-manual');
      const descManual = parseFloat(descManualInput.value) || 0;
      
      const payload = {
        cliente_id: document.getElementById('checkout-cliente').value || null,
        tipo_comprobante: document.getElementById('checkout-tipo').value,
        metodo_pago: document.getElementById('checkout-pago').value,
        subtotal: this.getSubtotal(),
        descuento: this.getDescuentoTotal() + descManual,
        total: Math.max(0, this.getTotal() - descManual),
        items: this.cart.map(i => ({
          producto_id: i.producto_id,
          variante_id: i.variante_id || null,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento_item: i.descuento_item,
          subtotal_item: i.subtotal_item
        }))
      };

      const res = await api.post('/ventas', payload);
      
      if (res.success) {
        app.closeModal('modal-checkout');
        
        // Setup post-sale modal
        document.getElementById('venta-exitosa-nro').textContent = `Comprobante: ${res.numero_comprobante}`;
        const token = localStorage.getItem('token');
        document.getElementById('btn-print-ticket').onclick = () => app.printUrl(`${API_URL}/ventas/${res.venta_id || res.id}/ticket?token=${token}`);
        
        document.getElementById('btn-whatsapp-ticket').onclick = async () => {
          const phoneInput = document.getElementById('wa-phone-input');
          const phone = phoneInput ? phoneInput.value.trim() : '';
          if (!phone) {
            return app.showToast('Por favor ingrese un número de WhatsApp', 'warning');
          }
          
          const textMsg = `¡Hola! Gracias por su compra en Joyería Mariné. Adjunto su comprobante (${res.numero_comprobante}).`;
          const pdfUrl = `${API_URL}/ventas/${res.venta_id || res.id}/pdf?token=${token}`;
          
          const btnWa = document.getElementById('btn-whatsapp-ticket');
          btnWa.disabled = true;
          
          try {
            app.showToast('Generando boleta PDF...', 'info');
            const response = await fetch(pdfUrl);
            if (!response.ok) throw new Error('Error al generar PDF');
            const blob = await response.blob();
            const file = new File([blob], `Boleta_${res.numero_comprobante}.pdf`, { type: 'application/pdf' });
            
            // Download PDF directly (forces standard download on PC and mobile)
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            // Copy text and open WA with the specific phone number
            try {
              await navigator.clipboard.writeText(textMsg);
              app.showToast('PDF descargado y mensaje copiado. Adjunta el archivo en WhatsApp.', 'success');
            } catch (e) {
              app.showToast('PDF descargado. Puedes adjuntarlo en WhatsApp.', 'success');
            }
            
            setTimeout(() => {
              window.open(`https://wa.me/${phone}`, '_blank');
            }, 500);
            
          } catch (err) {
            console.error(err);
            app.showToast('Error al preparar envío por WhatsApp', 'error');
          } finally {
            btnWa.disabled = false;
          }
        };
        app.openModal('modal-venta-exitosa');
      }
    } catch (err) {
      app.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmar Venta';
    }
  },

  onRealtimeEvent(eventName) {
    if (eventName === 'product:updated' || eventName === 'product:created' || eventName === 'product:deleted' || eventName === 'stock:changed') {
      this.loadData();
    }
  },

  updateTotalCheckout() {
    const descManualInput = document.getElementById('checkout-descuento-manual');
    const descManual = parseFloat(descManualInput.value) || 0;
    const finalTotal = Math.max(0, this.getTotal() - descManual);
    document.getElementById('checkout-total-display').textContent = `S/ ${finalTotal.toFixed(2)}`;
  },

  newSale() {
    app.closeModal('modal-venta-exitosa');
    this.cart = [];
    this.renderCart();
    
    // Hide mobile cart if open
    const cartPanel = document.getElementById('pos-cart-panel');
    if (cartPanel) cartPanel.classList.remove('active');
    
    this.loadData();
  },

  load() {
    window.posAddToCart = this.addToCart.bind(this);
    window.posSelectVariant = this.selectVariant.bind(this);
    window.posUpdateQty = this.updateQuantity.bind(this);
    window.posUpdateTotalCheckout = this.updateTotalCheckout.bind(this);
    window.posNewSale = this.newSale.bind(this);
  }
};
