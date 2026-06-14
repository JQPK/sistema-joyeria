import { auth } from './auth.js';
import { api } from './api.js';

window.app = {
  socket: null,
  pages: {},

  async init() {
    this.bindEvents();
    
    // Check auth flow
    const hasUsers = await auth.checkSetup();
    if (!hasUsers) {
      this.showScreen('screen-setup');
      return;
    }

    if (!auth.isAuthenticated()) {
      this.showScreen('screen-login');
      return;
    }

    // Is Authenticated
    this.setupUserUI();
    this.connectRealtime();
    this.showScreen('app-container');
    
    // Initial Route
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());
  },

  bindEvents() {
    // Setup Form
    const setupForm = document.getElementById('form-setup');
    if (setupForm) {
      setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('setup-nombre').value;
        const username = document.getElementById('setup-username').value;
        const password = document.getElementById('setup-password').value;
        
        try {
          await auth.setup(nombre, username, password);
          this.showToast('Administrador creado con éxito. Inicia sesión.', 'success');
          this.showScreen('screen-login');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Login Form
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errDiv = document.getElementById('login-error');
        
        try {
          await auth.login(username, password);
          window.location.reload();
        } catch (err) {
          errDiv.textContent = err.message;
          errDiv.classList.remove('hidden');
        }
      });
    }

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => auth.logout());
    }

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
      });
      // Close sidebar when clicking outside
      document.addEventListener('click', (e) => {
        if (window.innerWidth < 768 && 
            sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
          sidebar.classList.remove('active');
        }
      });
    }
  },

  setupUserUI() {
    const user = auth.getUser();
    if (!user) return;

    document.getElementById('ui-username').textContent = user.nombre;
    document.getElementById('ui-userrol').textContent = user.rol;

    // RBAC: Hide admin-only elements for cajero
    if (user.rol !== 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }
  },

  connectRealtime() {
    if (typeof io !== 'undefined') {
      this.socket = io('https://joyeria-marine-server.onrender.com');
      
      this.socket.on('connect', () => {
        const badge = document.getElementById('connection-status');
        if(badge) {
          badge.textContent = 'Online';
          badge.className = 'badge badge-success';
        }
      });

      this.socket.on('disconnect', () => {
        const badge = document.getElementById('connection-status');
        if(badge) {
          badge.textContent = 'Offline';
          badge.className = 'badge badge-danger';
        }
      });

      // Global event listener forwarding to active page
      this.socket.onAny((eventName, ...args) => {
        const activePage = location.hash.replace('#', '') || 'dashboard';
        if (this.pages[activePage] && typeof this.pages[activePage].onRealtimeEvent === 'function') {
          this.pages[activePage].onRealtimeEvent(eventName, args);
        }
      });
    }
  },

  showScreen(id) {
    ['screen-setup', 'screen-login', 'app-container'].forEach(sid => {
      document.getElementById(sid).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
  },

  async handleRoute() {
    const hash = window.location.hash || '#dashboard';
    const pageId = hash.replace('#', '');
    
    // RBAC check
    if (['reportes', 'inventario', 'caja', 'configuracion', 'usuarios'].includes(pageId) && !auth.isAdmin()) {
      window.location.hash = '#dashboard';
      this.showToast('Acceso denegado', 'error');
      return;
    }

    // Hide all pages
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    
    // Deactivate all navs
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.remove('active'));
    
    // Show current page
    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) {
      pageEl.classList.remove('hidden');
      
      // Activate nav
      document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));
      
      // Update mobile title
      const navItem = document.querySelector(`.sidebar-nav [data-page="${pageId}"]`);
      if (navItem) {
        document.getElementById('topbar-title').textContent = navItem.textContent.trim();
      }

      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('active');

      // Load module dynamically if not loaded
      if (!this.pages[pageId]) {
        try {
          const module = await import(`./pages/${pageId}.js`);
          this.pages[pageId] = module.default;
          await this.pages[pageId].init(pageEl);
        } catch (err) {
          console.warn(`No module found for page: ${pageId} or error loading`, err);
          pageEl.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:64px;height:64px;color:var(--text-secondary)"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <h2>En Construcción</h2>
            <p class="text-muted">La vista ${pageId} está siendo desarrollada.</p>
          </div>`;
        }
      }
      
      // Call load on every navigation
      if (this.pages[pageId] && typeof this.pages[pageId].load === 'function') {
        this.pages[pageId].load();
      }
    } else {
      // 404
      window.location.hash = '#dashboard';
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    if (type === 'success') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    else if (type === 'error') icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    else icon = '<svg viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

    toast.innerHTML = `<div style="width:24px;height:24px">${icon}</div><div>${message}</div>`;
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    // Move modal to body so it escapes any overflow:hidden/auto ancestors
    if (modal.parentElement !== document.body) {
      modal._originalParent = modal.parentElement;
      document.body.appendChild(modal);
    }

    // Use rAF to ensure the DOM move is rendered before adding the class
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('active');

    // Return modal to its original parent after animation ends
    setTimeout(() => {
      if (modal._originalParent && document.body.contains(modal._originalParent)) {
        modal._originalParent.appendChild(modal);
        delete modal._originalParent;
      }
    }, 350);

    // If closing the scanner modal, stop the camera
    if (id === 'modal-scanner') {
      import('./scanner.js').then(m => m.scanner.close()).catch(() => {});
    }
  }
};

// Start app
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
