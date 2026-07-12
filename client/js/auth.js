import { api } from './api.js';

export const auth = {
  async checkSetup() {
    try {
      const res = await api.get('/auth/check-users');
      return res.hasUsers;
    } catch (e) {
      console.error('Error checking setup', e);
      return true; // Fallback to avoid setup loop
    }
  },

  async setup(nombre, username, password) {
    const res = await api.post('/auth/setup', { nombre, username, password });
    return res.success;
  },

  async login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    if (res.success) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
    }
    return res;
  },

  async logout() {
    // Log logout activity (best-effort, don't block if it fails)
    try {
      await api.post('/actividad', { accion: 'LOGOUT', detalles: 'Sesión cerrada por el usuario' });
    } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '';
    window.location.reload();
  },

  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken() {
    return localStorage.getItem('token');
  },

  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.rol === 'admin';
  }
};
