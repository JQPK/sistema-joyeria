import { api } from '../api.js';

export default {
  container: null,
  todosLosItems: [],    // [{id, codigo, nombre, tipo:'producto'|'variante'}]
  seleccionados: new Set(),
  categorias: [],

  async init(container) {
    this.container = container;
    this.container.innerHTML = this._htmlPrincipal();
    await this._cargarDatos();
    this._bindEventos();
  },

  load() {
    // Llamado en cada navegación; nada extra necesario
  },

  // ── HTML PRINCIPAL ────────────────────────────────────────────────────────

  _htmlPrincipal() {
    return `
    <!-- ESTILOS DE IMPRESIÓN (solo aplican al hacer Ctrl+P) -->
    <style id="etiquetas-print-style">
      @media print {
        body > *:not(#app) { display:none !important; }
        #app > *:not(#main-area) { display:none !important; }
        #main-area > *:not(#main-content) { display:none !important; }
        #main-content > *:not(#page-etiquetas) { display:none !important; }
        #page-etiquetas > *:not(#zona-impresion) { display:none !important; }
        #zona-impresion {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr);
          gap: 4mm;
          padding: 8mm;
          background: white;
        }
        .etiqueta-item {
          border: 0.5pt solid #ccc;
          border-radius: 2mm;
          padding: 2mm;
          text-align: center;
          page-break-inside: avoid;
          background: white;
        }
        .etiqueta-item svg { width: 100%; height: auto; max-height: 18mm; }
        .etiqueta-sku  { font-size: 7pt; font-weight: bold; font-family: monospace; margin-top: 1mm; color:#000; }
        .etiqueta-nombre { font-size: 6pt; color: #333; margin-top: 0.5mm; font-family: sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      }
    </style>

    <!-- ZONA DE IMPRESIÓN: solo etiquetas, sin controles -->
    <div id="zona-impresion" style="display:none"></div>

    <!-- CONTROLES (visibles en pantalla, ocultos al imprimir) -->
    <div id="etiquetas-controles">

      <!-- Cabecera -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header">
          <h2 class="text-gold" style="display:flex;align-items:center;gap:.5rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            Generador de Etiquetas
          </h2>
          <button id="btn-imprimir" class="btn btn-primary" style="gap:.4rem;display:flex;align-items:center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir
          </button>
        </div>

        <!-- Filtros -->
        <div class="card-body" style="padding-bottom:.5rem">
          <div style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end">

            <div class="form-group" style="margin:0;flex:1;min-width:140px">
              <label class="form-label" style="font-size:.78rem">Categoría</label>
              <select id="et-filtro-cat" class="form-control">
                <option value="">Todas las categorías</option>
              </select>
            </div>

            <div class="form-group" style="margin:0;min-width:110px">
              <label class="form-label" style="font-size:.78rem">Copias por producto</label>
              <select id="et-copias" class="form-control">
                <option value="1">1 copia</option>
                <option value="2">2 copias</option>
                <option value="3" selected>3 copias</option>
                <option value="4">4 copias</option>
                <option value="5">5 copias</option>
                <option value="10">10 copias</option>
              </select>
            </div>

            <div class="form-group" style="margin:0;min-width:110px">
              <label class="form-label" style="font-size:.78rem">Tamaño etiqueta</label>
              <select id="et-tamano" class="form-control">
                <option value="small">Pequeño</option>
                <option value="medium" selected>Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>

            <div style="margin:0;display:flex;gap:.5rem">
              <button class="btn btn-secondary" onclick="window.etSelAll()">✅ Todos</button>
              <button class="btn btn-secondary" onclick="window.etSelNone()">❌ Ninguno</button>
              <button class="btn btn-primary" onclick="window.etAplicar()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Actualizar vista
              </button>
            </div>
          </div>

          <!-- Contador -->
          <div style="margin-top:.75rem;font-size:.82rem;color:var(--text-muted)" id="et-contador">
            Cargando productos...
          </div>
        </div>
      </div>

      <!-- Lista de selección -->
      <div class="card" style="margin-bottom:1rem">
        <div class="card-header" style="padding-bottom:.25rem">
          <h3 style="font-size:.95rem;font-weight:600">Selección de productos</h3>
          <span style="font-size:.78rem;color:var(--text-muted)">Marca los que quieres imprimir</span>
        </div>
        <div class="card-body" style="padding-top:.5rem;max-height:360px;overflow-y:auto">
          <div id="et-lista-productos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.5rem">
            <div class="text-center text-muted" style="grid-column:1/-1;padding:2rem">Cargando...</div>
          </div>
        </div>
      </div>

      <!-- Vista previa -->
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:.95rem;font-weight:600">Vista previa de impresión</h3>
          <span style="font-size:.78rem;color:var(--text-muted)" id="et-preview-count">—</span>
        </div>
        <div class="card-body" style="padding:.75rem">
          <div id="et-preview"
               style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:#f0f0f0;padding:8px;border-radius:8px;min-height:100px">
            <div class="text-center text-muted" style="grid-column:1/-1;padding:2rem;background:white;border-radius:6px">
              Ajusta los filtros y presiona <strong>Actualizar vista</strong>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /etiquetas-controles -->
    `;
  },

  // ── CARGA DE DATOS ────────────────────────────────────────────────────────

  async _cargarDatos() {
    try {
      const [resProd, resCat] = await Promise.all([
        api.get('/productos'),
        api.get('/categorias')
      ]);

      this.categorias = resCat.success ? resCat.data : [];
      this.todosLosItems = [];

      if (resProd.success) {
        for (const p of resProd.data) {
          if (p.tiene_variantes && p.variantes && p.variantes.length > 0) {
            // Cada variante es una etiqueta independiente
            for (const v of p.variantes) {
              const sku = v.sku || p.codigo || `VAR-${v.id}`;
              const nombre = `${p.nombre} — ${v.nombre_variante}`;
              this.todosLosItems.push({
                id: `v-${v.id}`,
                codigo: sku,
                nombre: nombre,
                categoria_id: p.categoria_id,
                tipo: 'variante'
              });
            }
          } else {
            const codigo = p.codigo || `PROD-${p.id}`;
            this.todosLosItems.push({
              id: `p-${p.id}`,
              codigo: codigo,
              nombre: p.nombre,
              categoria_id: p.categoria_id,
              tipo: 'producto'
            });
          }
        }
      }

      // Seleccionar todos por defecto
      this.seleccionados = new Set(this.todosLosItems.map(i => i.id));

      this._poblarCategoriasSelect();
      this._renderLista(this.todosLosItems);
      this._actualizarContador();
    } catch (err) {
      console.error('Error cargando productos para etiquetas:', err);
      if (typeof app !== 'undefined') app.showToast('Error cargando productos', 'error');
    }
  },

  _poblarCategoriasSelect() {
    const sel = document.getElementById('et-filtro-cat');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      this.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  },

  // ── RENDER LISTA DE SELECCIÓN ─────────────────────────────────────────────

  _renderLista(items) {
    const cont = document.getElementById('et-lista-productos');
    if (!cont) return;

    if (items.length === 0) {
      cont.innerHTML = '<div class="text-center text-muted" style="grid-column:1/-1;padding:2rem">No hay productos en esta categoría</div>';
      return;
    }

    cont.innerHTML = items.map(item => {
      const checked = this.seleccionados.has(item.id) ? 'checked' : '';
      const badge = item.tipo === 'variante'
        ? `<span style="font-size:.65rem;background:rgba(167,139,250,.2);color:#a78bfa;padding:1px 5px;border-radius:4px;margin-left:4px">variante</span>`
        : '';
      return `
        <label style="display:flex;align-items:center;gap:.5rem;padding:.45rem .6rem;border-radius:6px;
                       border:1px solid var(--border);cursor:pointer;background:var(--bg-card);transition:border-color .15s"
               class="et-label-row" data-id="${item.id}">
          <input type="checkbox" class="et-chk" data-id="${item.id}" ${checked}
                 style="accent-color:var(--primary);width:15px;height:15px;flex-shrink:0">
          <div style="min-width:0">
            <div style="font-size:.82rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${item.nombre}${badge}
            </div>
            <div style="font-size:.72rem;color:var(--text-muted);font-family:monospace">${item.codigo}</div>
          </div>
        </label>
      `;
    }).join('');

    // Eventos de checkbox
    cont.querySelectorAll('.et-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.id;
        if (chk.checked) this.seleccionados.add(id);
        else this.seleccionados.delete(id);
        this._actualizarContador();
        // Resaltar fila
        const row = chk.closest('.et-label-row');
        if (row) row.style.borderColor = chk.checked ? 'var(--primary)' : 'var(--border)';
      });
      // Resalte inicial
      const row = chk.closest('.et-label-row');
      if (row && chk.checked) row.style.borderColor = 'var(--primary)';
    });
  },

  // ── ACTUALIZAR VISTA PREVIA ───────────────────────────────────────────────

  _actualizarContador() {
    const el = document.getElementById('et-contador');
    if (el) {
      const total = this.todosLosItems.length;
      const sel = this.seleccionados.size;
      el.textContent = `${total} items en total — ${sel} seleccionados`;
    }
  },

  _aplicarFiltro() {
    const catId = document.getElementById('et-filtro-cat')?.value || '';
    const filtrados = catId
      ? this.todosLosItems.filter(i => String(i.categoria_id) === catId)
      : this.todosLosItems;
    this._renderLista(filtrados);
    // Restaurar estado visual de checkboxes
    document.querySelectorAll('.et-chk').forEach(chk => {
      const sel = this.seleccionados.has(chk.dataset.id);
      chk.checked = sel;
      const row = chk.closest('.et-label-row');
      if (row) row.style.borderColor = sel ? 'var(--primary)' : 'var(--border)';
    });
    this._actualizarContador();
  },

  _generarVistaPrevia() {
    const copias = parseInt(document.getElementById('et-copias')?.value || '3');
    const tamano = document.getElementById('et-tamano')?.value || 'medium';

    const items = this.todosLosItems.filter(i => this.seleccionados.has(i.id));
    if (items.length === 0) {
      const prev = document.getElementById('et-preview');
      if (prev) prev.innerHTML = '<div class="text-center text-muted" style="grid-column:1/-1;padding:2rem;background:white;border-radius:6px">No hay productos seleccionados</div>';
      return;
    }

    // Calcular dimensiones según tamaño
    const dims = {
      small:  { w: 120, h: 40, fontSize: 7, labelFont: 6 },
      medium: { w: 180, h: 50, fontSize: 9, labelFont: 7 },
      large:  { w: 240, h: 60, fontSize: 11, labelFont: 8 }
    };
    const d = dims[tamano];

    // Generar etiquetas (cada item × copias)
    const etiquetas = [];
    for (const item of items) {
      for (let c = 0; c < copias; c++) {
        etiquetas.push(item);
      }
    }

    // Renderizar en vista previa
    const prev = document.getElementById('et-preview');
    if (!prev) return;
    prev.innerHTML = etiquetas.map((item, idx) => `
      <div class="etiqueta-preview-card" style="background:white;border:1px solid #ddd;border-radius:4px;
            padding:4px;text-align:center;font-family:sans-serif">
        <svg id="et-bc-${idx}" style="width:100%;height:${d.h}px"></svg>
        <div style="font-size:${d.fontSize}px;font-weight:700;font-family:monospace;color:#000;margin-top:2px;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.codigo}</div>
        <div style="font-size:${d.labelFont}px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
             title="${item.nombre}">${item.nombre}</div>
      </div>
    `).join('');

    // Dibujar códigos de barras
    etiquetas.forEach((item, idx) => {
      try {
        JsBarcode(`#et-bc-${idx}`, item.codigo, {
          format: 'CODE128',
          displayValue: false,
          margin: 2,
          width: 1.2,
          height: d.h - 4,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (e) {
        const el = document.querySelector(`#et-bc-${idx}`);
        if (el) el.innerHTML = `<text y="50%" fill="red" font-size="8">Código inválido</text>`;
      }
    });

    // Actualizar contador de vista previa
    const countEl = document.getElementById('et-preview-count');
    if (countEl) countEl.textContent = `${etiquetas.length} etiquetas — ≈${Math.ceil(etiquetas.length / 40)} hoja(s) A4`;
  },

  // ── IMPRIMIR ──────────────────────────────────────────────────────────────

  _imprimir() {
    const copias  = parseInt(document.getElementById('et-copias')?.value  || '3');
    const tamano  = document.getElementById('et-tamano')?.value || 'medium';

    const items = this.todosLosItems.filter(i => this.seleccionados.has(i.id));
    if (items.length === 0) {
      if (typeof app !== 'undefined') app.showToast('Selecciona al menos un producto', 'error');
      return;
    }

    // Expandir: cada item × copias
    const etiquetas = [];
    for (const item of items) {
      for (let c = 0; c < copias; c++) etiquetas.push(item);
    }

    // Dimensiones según tamaño elegido
    const dims = {
      small:  { bh: 30, fs: 7,  lf: 6  },
      medium: { bh: 40, fs: 9,  lf: 7  },
      large:  { bh: 52, fs: 11, lf: 8  }
    };
    const d = dims[tamano];

    // Construir HTML de las etiquetas como cadena
    // Usamos <canvas> porque la ventana nueva tendrá JsBarcode disponible
    const labelsHtml = etiquetas.map((item, idx) => `
      <div class="lbl">
        <canvas id="bc${idx}"></canvas>
        <div class="sku">${item.codigo}</div>
        <div class="nom">${item.nombre.replace(/</g,'&lt;')}</div>
      </div>
    `).join('');

    // Obtener URL de JsBarcode para incluirla en la ventana nueva
    const jsbUrl = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Etiquetas — Joyería Mariné</title>
  <script src="${jsbUrl}"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; font-family: Arial, sans-serif; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 3mm;
      padding: 8mm;
    }
    .lbl {
      border: 0.4pt solid #bbb;
      border-radius: 2mm;
      padding: 2mm 2mm 1.5mm;
      text-align: center;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .lbl canvas { width: 100%; max-height: ${d.bh}px; display: block; }
    .sku { font-size: ${d.fs}pt; font-weight: bold; font-family: monospace;
           margin-top: 1mm; color: #000; }
    .nom { font-size: ${d.lf}pt; color: #444; margin-top: 0.5mm;
           overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="grid">${labelsHtml}</div>
  <script>
    window.onload = function() {
      const items = ${JSON.stringify(etiquetas)};
      items.forEach(function(item, idx) {
        try {
          JsBarcode('#bc' + idx, item.codigo, {
            format: 'CODE128',
            displayValue: false,
            margin: 2,
            width: 1.6,
            height: ${d.bh},
            background: '#ffffff',
            lineColor: '#000000'
          });
        } catch(e) {}
      });
      // Pequeña espera para que el render de canvas termine, luego imprime
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>`;

    // Abrir ventana nueva y escribir el contenido
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      if (typeof app !== 'undefined') app.showToast('Permite las ventanas emergentes en tu navegador', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  },


  // ── BIND EVENTOS ─────────────────────────────────────────────────────────

  _bindEventos() {
    document.getElementById('btn-imprimir')?.addEventListener('click', () => this._imprimir());
    document.getElementById('et-filtro-cat')?.addEventListener('change', () => this._aplicarFiltro());

    window.etSelAll  = () => {
      // Seleccionar todos los visibles en lista actual
      document.querySelectorAll('.et-chk').forEach(chk => {
        chk.checked = true;
        this.seleccionados.add(chk.dataset.id);
        const row = chk.closest('.et-label-row');
        if (row) row.style.borderColor = 'var(--primary)';
      });
      this._actualizarContador();
    };

    window.etSelNone = () => {
      document.querySelectorAll('.et-chk').forEach(chk => {
        chk.checked = false;
        this.seleccionados.delete(chk.dataset.id);
        const row = chk.closest('.et-label-row');
        if (row) row.style.borderColor = 'var(--border)';
      });
      this._actualizarContador();
    };

    window.etAplicar = () => this._generarVistaPrevia();
  }
};
