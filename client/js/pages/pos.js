import { api } from '../api.js';

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
      document.getElementById('checkout-total-display').textContent = `S/ ${this.getTotal().toFixed(2)}`;
      app.openModal('modal-checkout');
    });

    // Confirm Sale
    document.getElementById('btn-confirm-checkout').addEventListener('click', async () => {
      await this.processSale();
    });
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
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm) || 
        (p.codigo && p.codigo.toLowerCase().includes(searchTerm))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="text-muted w-full" style="grid-column: 1/-1; padding: 2rem; text-align: center">No se encontraron productos</div>';
      return;
    }

    container.innerHTML = filtered.map(p => `
      <div class="product-card" onclick="window.posAddToCart(${p.id})">
        ${p.descuento_porcentaje > 0 ? `<div class="badge badge-danger" style="position:absolute; top:8px; right:8px; z-index:2">-${parseFloat(p.descuento_porcentaje)}%</div>` : ''}
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

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existing = this.cart.find(item => item.producto_id === productId);
    
    if (existing) {
      if (existing.cantidad < product.stock_actual) {
        existing.cantidad++;
        existing.subtotal_item = existing.cantidad * existing.precio_unitario;
      } else {
        app.showToast('Stock máximo alcanzado', 'warning');
      }
    } else {
      const precio = parseFloat(product.precio_venta);
      const desc = parseFloat(product.descuento_porcentaje || 0);
      const descuentoItem = desc > 0 ? (precio * desc / 100) : 0;
      const precioFinal = precio - descuentoItem;
      
      this.cart.push({
        producto_id: product.id,
        nombre: product.nombre,
        cantidad: 1,
        precio_unitario: precio,
        descuento_item: descuentoItem,
        subtotal_item: precioFinal,
        stock_max: product.stock_actual
      });
    }
    
    this.renderCart();
  },

  updateQuantity(productId, delta) {
    const item = this.cart.find(i => i.producto_id === productId);
    if (!item) return;

    item.cantidad += delta;
    if (item.cantidad <= 0) {
      this.cart = this.cart.filter(i => i.producto_id !== productId);
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
          <div class="cart-item-title">${item.nombre}</div>
          <div class="text-muted" style="font-size: 0.8rem">S/ ${item.precio_unitario.toFixed(2)} c/u</div>
          ${item.descuento_item > 0 ? `<div class="badge badge-danger mt-1">Desc: S/ ${item.descuento_item.toFixed(2)}</div>` : ''}
        </div>
        <div class="flex-col items-center gap-2">
          <div class="cart-item-price">S/ ${item.subtotal_item.toFixed(2)}</div>
          <div class="cart-controls">
            <button onclick="window.posUpdateQty(${item.producto_id}, -1)">-</button>
            <span style="min-width:20px;text-align:center">${item.cantidad}</span>
            <button onclick="window.posUpdateQty(${item.producto_id}, 1)">+</button>
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
      const payload = {
        cliente_id: document.getElementById('checkout-cliente').value || null,
        tipo_comprobante: document.getElementById('checkout-tipo').value,
        metodo_pago: document.getElementById('checkout-pago').value,
        subtotal: this.getSubtotal(),
        descuento: this.getDescuentoTotal(),
        total: this.getTotal(),
        items: this.cart
      };

      const res = await api.post('/ventas', payload);
      
      if (res.success) {
        app.closeModal('modal-checkout');
        app.showToast(`Venta exitosa: ${res.numero_comprobante}`, 'success');
        
        // Clear cart
        this.cart = [];
        this.renderCart();
        
        // Hide mobile cart if open
        const cartPanel = document.getElementById('pos-cart-panel');
        if (cartPanel) cartPanel.classList.remove('active');
        
        // Realtime will update products, but we can do it manually to be fast
        await this.loadData();
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

  load() {
    // Attach globals for inline onclick handlers (temporary solution for Vanilla JS without bundler)
    window.posAddToCart = this.addToCart.bind(this);
    window.posUpdateQty = this.updateQuantity.bind(this);
  }
};
