import { api } from '../api.js';

// Color and icon config per action type
const ACTION_CONFIG = {
  'LOGIN':              { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: '🔓', label: 'Inicio de Sesión' },
  'LOGIN_FALLIDO':      { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '🚫', label: 'Acceso Fallido' },
  'VENTA_COMPLETADA':   { color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: '💰', label: 'Venta' },
  'BOLETA_ANULADA':     { color: '#fb923c', bg: 'rgba(251,146,60,0.12)', icon: '↩️', label: 'Anulación' },
  'PRODUCTO_CREADO':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: '➕', label: 'Producto Creado' },
  'PRODUCTO_ELIMINADO': { color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '🗑️', label: 'Producto Eliminado' },
  'STOCK_ACTUALIZADO':  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: '📦', label: 'Stock Actualizado' },
  'VARIANTE_MODIFICADA':{ color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '✏️', label: 'Variante Modificada' },
  'IMPORTACION_EXCEL':  { color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: '📊', label: 'Importación Excel' },
  'MOVIMIENTO_CAJA':    { color: '#f9a8d4', bg: 'rgba(249,168,212,0.12)', icon: '💵', label: 'Movimiento de Caja' },
  'USUARIO_CREADO':     { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: '👤', label: 'Usuario Creado' },
  'USUARIO_MODIFICADO': { color: '#c4b5fd', bg: 'rgba(196,181,253,0.12)', icon: '🔧', label: 'Usuario Modificado' },
};

const DEFAULT_CONFIG = { color: 'var(--text-muted)', bg: 'var(--bg-secondary)', icon: '•', label: 'Actividad' };

function getConfig(accion) {
  return ACTION_CONFIG[accion] || DEFAULT_CONFIG;
}

export default {
  container: null,
  refreshInterval: null,
  usuarios: [],

  async init(container) {
    this.container = container;

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    this.container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1.5rem">

        <!-- Stats Row -->
        <div id="bit-stats-row" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:1rem">
          ${this._statCard('bit-stat-total', '—', 'Actividades hoy', '📋')}
          ${this._statCard('bit-stat-logins', '—', 'Inicios de sesión', '🔓')}
          ${this._statCard('bit-stat-ventas', '—', 'Ventas realizadas', '💰')}
          ${this._statCard('bit-stat-stock', '—', 'Cambios de stock', '📦')}
          ${this._statCard('bit-stat-fallidos', '—', 'Accesos fallidos', '🚫')}
          ${this._statCard('bit-stat-inventario', '—', 'Cambios inventario', '🗂️')}
        </div>

        <!-- Filter Card -->
        <div class="card">
          <div class="card-header">
            <h2 class="text-gold" style="font-size:1.2rem; display:flex; align-items:center; gap:.5rem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Bitácora de Actividad
            </h2>
            <div style="display:flex; align-items:center; gap:.5rem">
              <span id="bit-auto-refresh" style="font-size:.75rem; color:var(--text-muted)">🔄 Actualiza en <span id="bit-countdown">60</span>s</span>
              <button class="btn btn-secondary btn-sm" onclick="window.bitExport()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Exportar
              </button>
            </div>
          </div>
          <div class="card-body" style="padding-bottom:.75rem">
            <div style="display:flex; flex-wrap:wrap; gap:.75rem; align-items:flex-end">
              <div class="form-group" style="margin:0; flex:1; min-width:130px">
                <label class="form-label" style="font-size:.78rem">Desde</label>
                <input type="date" id="bit-fecha-inicio" class="form-control" value="${sevenDaysAgo}">
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:130px">
                <label class="form-label" style="font-size:.78rem">Hasta</label>
                <input type="date" id="bit-fecha-fin" class="form-control" value="${today}">
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:150px">
                <label class="form-label" style="font-size:.78rem">Usuario</label>
                <select id="bit-usuario" class="form-control">
                  <option value="">Todos los usuarios</option>
                </select>
              </div>
              <div class="form-group" style="margin:0; flex:1; min-width:170px">
                <label class="form-label" style="font-size:.78rem">Tipo de Acción</label>
                <select id="bit-accion" class="form-control">
                  <option value="">Todas las acciones</option>
                  ${Object.entries(ACTION_CONFIG).map(([key, cfg]) => `<option value="${key}">${cfg.icon} ${cfg.label}</option>`).join('')}
                </select>
              </div>
              <div style="margin:0">
                <button class="btn btn-primary" onclick="window.bitLoad()">🔍 Filtrar</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Table Card -->
        <div class="card">
          <div class="card-body" style="padding:0">
            <div class="table-responsive">
              <table class="data-table" id="bit-table">
                <thead>
                  <tr>
                    <th style="width:160px">Fecha/Hora</th>
                    <th style="width:140px">Usuario</th>
                    <th style="width:160px">Acción</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    `;

    await this.loadUsers();
    await this.loadData();
    this.startAutoRefresh();
  },

  _statCard(id, value, label, icon) {
    return `
      <div class="card" style="padding:1rem; text-align:center">
        <div style="font-size:1.5rem; margin-bottom:.25rem">${icon}</div>
        <div id="${id}" style="font-size:1.6rem; font-weight:700; color:var(--text-primary)">${value}</div>
        <div style="font-size:.72rem; color:var(--text-muted); margin-top:.15rem">${label}</div>
      </div>
    `;
  },

  async loadUsers() {
    try {
      const res = await api.get('/usuarios');
      if (res.success) {
        this.usuarios = res.data;
        const select = document.getElementById('bit-usuario');
        if (select) {
          select.innerHTML = '<option value="">Todos los usuarios</option>' +
            res.data.map(u => `<option value="${u.id}">${u.nombre} (${u.rol})</option>`).join('');
        }
      }
    } catch (_) {}
  },

  async loadStats() {
    try {
      const res = await api.get('/actividad/stats');
      if (res.success) {
        const d = res.data;
        document.getElementById('bit-stat-total').textContent = d.total_hoy || 0;
        document.getElementById('bit-stat-logins').textContent = d.logins || 0;
        document.getElementById('bit-stat-ventas').textContent = d.ventas || 0;
        document.getElementById('bit-stat-stock').textContent = d.cambios_stock || 0;
        document.getElementById('bit-stat-fallidos').textContent = d.logins_fallidos || 0;
        document.getElementById('bit-stat-inventario').textContent = d.cambios_inventario || 0;
      }
    } catch (_) {}
  },

  async loadData() {
    try {
      const params = {};
      const fi = document.getElementById('bit-fecha-inicio');
      const ff = document.getElementById('bit-fecha-fin');
      const bu = document.getElementById('bit-usuario');
      const ba = document.getElementById('bit-accion');
      if (fi && fi.value) params.fecha_inicio = fi.value;
      if (ff && ff.value) params.fecha_fin = ff.value;
      if (bu && bu.value) params.usuario_id = bu.value;
      if (ba && ba.value) params.accion = ba.value;

      const [res] = await Promise.all([
        api.get('/actividad', params),
        this.loadStats()
      ]);

      if (res.success) this.renderTable(res.data);
    } catch (err) {
      if (typeof app !== 'undefined') app.showToast('Error cargando bitácora', 'error');
    }
  },

  renderTable(data) {
    const tbody = document.querySelector('#bit-table tbody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:2rem">No hay actividad registrada en este rango</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(a => {
      const cfg = getConfig(a.accion);
      const fecha = new Date(a.fecha).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      return `
        <tr>
          <td class="text-muted" style="font-size:.82rem; white-space:nowrap">${fecha}</td>
          <td>
            <div style="font-weight:600; font-size:.9rem">${a.usuario_nombre}</div>
            <div style="font-size:.75rem; color:var(--text-muted)">${a.usuario_rol}</div>
          </td>
          <td>
            <span style="display:inline-flex; align-items:center; gap:.3rem; padding:.2rem .6rem; border-radius:999px; background:${cfg.bg}; color:${cfg.color}; font-size:.78rem; font-weight:600; white-space:nowrap">
              ${cfg.icon} ${cfg.label}
            </span>
          </td>
          <td style="font-size:.85rem; color:var(--text-secondary)">${a.detalles || '—'}</td>
        </tr>
      `;
    }).join('');
  },

  startAutoRefresh() {
    let seconds = 60;
    const countdownEl = () => document.getElementById('bit-countdown');

    if (this.refreshInterval) clearInterval(this.refreshInterval);

    this.refreshInterval = setInterval(() => {
      seconds--;
      const el = countdownEl();
      if (el) el.textContent = seconds;
      if (seconds <= 0) {
        seconds = 60;
        this.loadData();
      }
    }, 1000);
  },

  exportExcel() {
    const rows = [['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Detalle']];
    document.querySelectorAll('#bit-table tbody tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length < 4) return;
      const fecha = tds[0].textContent.trim();
      const userDiv = tds[1].querySelectorAll('div');
      const usuario = userDiv[0]?.textContent.trim() || '';
      const rol = userDiv[1]?.textContent.trim() || '';
      const accion = tds[2].textContent.trim();
      const detalle = tds[3].textContent.trim();
      rows.push([fecha, usuario, rol, accion, detalle]);
    });

    if (rows.length <= 1) return;

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bitácora');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Bitacora_Actividad_${dateStr}.xlsx`);
  },

  load() {
    window.bitLoad = this.loadData.bind(this);
    window.bitExport = this.exportExcel.bind(this);
  }
};
