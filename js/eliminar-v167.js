/* v167: pedido del usuario — 🗑️ Eliminar por SECCIONES de módulo (como Stock): una pestaña por
 * módulo (Inventario LDU, Modelos Ant. A, Modelos Ant. B, Stock, Incidencias, IMEI NO VIVO), cada
 * una con SUS propias tarjetas, filtros, columnas, selección y paginación, para que los filtros
 * no se mezclen. Las tarjetas son filtros: al pulsar una se filtra la tabla por ese estado/tipo
 * (pulsar la misma, o "Total", la quita). El historial de eliminaciones va paginado.
 * Cada módulo elimina con SU acción (deleteDevice / deleteStock / deleteIncident). */
(function () {
  'use strict';
  var esc = function (v) { return safe(v == null ? '' : v); };
  var nz = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var DEV_COLS = [['imei', 'IMEI'], ['marca', 'MARCA'], ['modelo', 'MODELO'], ['n_linea', 'N° LÍNEA'], ['responsable', 'RESPONSABLE'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['tipo', 'TIPO'], ['supervisor', 'SUPERVISOR'], ['zona', 'ZONA'], ['cuenta', 'CUENTA'], ['departamento', 'DEPARTAMENTO'], ['ciudad', 'CIUDAD'], ['canal', 'CANAL'], ['tienda', 'TIENDA'], ['tipo_uso', 'TIPO USO'], ['fecha_asignacion', 'F. ASIGNACIÓN'], ['monto', 'MONTO S/'], ['estado', 'ESTADO']];
  var STOCK_COLS = [['imei', 'IMEI'], ['cuenta', 'CUENTA'], ['marca', 'MARCA'], ['modelo', 'MODELO'], ['monto', 'MONTO S/'], ['fecha_ingreso', 'FECHA DE INGRESO'], ['guia', 'GUÍA'], ['en_inventario', 'EN INVENTARIO'], ['estado', 'ESTADO'], ['observaciones', 'OBSERVACIONES']];
  var INC_COLS = [['imei', 'IMEI ORIGINAL'], ['tipo', 'TIPO'], ['imei_nuevo', 'IMEI NUEVO'], ['responsable', 'NOMBRE COMPLETO'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['zona', 'ZONA'], ['supervisor', 'SUPERVISOR'], ['modelo', 'MODELO'], ['fecha_incidente', 'FECHA DEL INCIDENTE'], ['tipo_uso', 'TIPO USO'], ['monto', 'VALOR S/'], ['estado', 'ESTADO DEL PROCESO']];
  /* filtros por módulo: [id, etiqueta, campo] — el que se llama 'card' es el que las tarjetas controlan */
  var DEV_FILTERS = [['supervisor', 'SUPERVISOR', 'supervisor'], ['zona', 'ZONA', 'zona'], ['cuenta', 'CUENTA', 'cuenta'], ['modelo', 'MODELO', 'modelo'], ['tipo', 'TIPO', 'tipo'], ['tipo_uso', 'TIPO USO', 'tipo_uso'], ['estado', 'ESTADO', 'estado']];
  var TABS = [
    { id: 'inventory', label: '📱 Inventario LDU', kind: 'device', cols: DEV_COLS, filters: DEV_FILTERS, card: 'estado', cardLabel: 'estados' },
    { id: 'modelA', label: '🟦 Modelos Ant. A', kind: 'device', cols: DEV_COLS, filters: DEV_FILTERS, card: 'estado', cardLabel: 'estados' },
    { id: 'modelB', label: '🟧 Modelos Ant. B', kind: 'device', cols: DEV_COLS, filters: DEV_FILTERS, card: 'estado', cardLabel: 'estados' },
    { id: 'stock', label: '📦 Stock', kind: 'stock', cols: STOCK_COLS, filters: [['cuenta', 'CUENTA', 'cuenta'], ['marca', 'MARCA', 'marca'], ['modelo', 'MODELO', 'modelo'], ['en_inventario', 'EN INVENTARIO', 'en_inventario'], ['estado', 'ESTADO', 'estado']], card: 'estado', cardLabel: 'estados' },
    { id: 'incidents', label: '⚠️ Incidencias', kind: 'incident', cols: INC_COLS, filters: [['tipo', 'TIPO', 'tipo'], ['zona', 'ZONA', 'zona'], ['supervisor', 'SUPERVISOR', 'supervisor'], ['modelo', 'MODELO', 'modelo'], ['tipo_uso', 'TIPO USO', 'tipo_uso'], ['estado', 'ESTADO DEL PROCESO', 'estado']], card: 'tipo', cardLabel: 'tipos' },
    { id: 'novivo', label: '🚫 IMEI NO VIVO', kind: 'device', cols: DEV_COLS, filters: DEV_FILTERS, card: 'estado', cardLabel: 'estados' }
  ];

  function moneyOf(x) { return Number(x.monto || x.valor || 0) || 0; }
  function rowKey(t, x) { return t.kind === 'incident' ? String(x.id_incidencia || '') + '|' + String(x.imei || '') + '|' + String(x.tipo || '') : String(x.imei || ''); }

  function normalizeRows(rs) {
    var data = { inventory: [], modelA: [], modelB: [], stock: [], incidents: [], novivo: [] };
    (rs[0].data || []).forEach(function (x) {
      if (!x || !x.imei) return;
      var g = typeof groupFor === 'function' ? groupFor(x.modelo) : '';
      data[g === 'A' ? 'modelA' : g === 'B' ? 'modelB' : 'inventory'].push(x);
    });
    (rs[1].data || []).forEach(function (x) { if (x && x.imei) data.stock.push(Object.assign({}, x, { estado: x.estado_inventario || x.estado || '' })); });
    (rs[2].data || []).forEach(function (x) {
      var k = x && (x.imei_original || x.imei);
      if (k) data.incidents.push(Object.assign({}, x, { imei: k, responsable: x.responsable || x.nombre || x.nombre_completo || '', estado: x.estado_proceso || x.estado || '', monto: x.valor || x.monto || 0 }));
    });
    ((rs[3] && rs[3].data) || []).forEach(function (x) { if (x && x.imei) data.novivo.push(x); });
    return data;
  }

  window.renderDelete = renderDelete = async function () {
    try {
      loading('Cargando Eliminar...');
      var rs = await Promise.all([api('listDevices'), api('listStock'), api('listIncidents'), api('listImeiNoVivo').catch(function () { return { data: [] }; }), api('listDeleted')]);
      var data = normalizeRows(rs), deleted = (rs[4].data || []).slice().sort(function (a, b) { return String(b.eliminado_en || '') < String(a.eliminado_en || '') ? -1 : 1; });
      var ui = {};
      TABS.forEach(function (t) { ui[t.id] = { page: 1, q: '', f: {}, selected: {} }; });
      var active = 'inventory', delPage = 1, DEL_SIZE = 15, app = document.querySelector('#app');

      app.innerHTML = '<section class="section v167-delete"><div class="section-head"><h2>🗑️ Eliminar</h2><div><button class="btn secondary" id="v167-refresh">🔄 Actualizar</button><button class="btn secondary" id="v167-all">☑️ Seleccionar página</button><button class="btn danger" id="v167-delete">🗑️ Eliminar seleccionados</button></div></div>'
        + '<div class="stock-tabs v167-tabs" id="v167-tabs"></div><div id="v167-body"></div></section>'
        + '<section class="section"><div class="section-head"><h2>📋 Historial de eliminaciones</h2></div><div id="v167-hist"></div><div id="v167-hist-pager"></div></section>';

      function tabById(id) { return TABS.filter(function (t) { return t.id === id; })[0]; }
      function filtered(t, skipField) {
        var u = ui[t.id], q = nz(u.q);
        return data[t.id].filter(function (x) {
          if (q && !Object.keys(x).some(function (k) { return typeof x[k] !== 'object' && nz(x[k]).indexOf(q) >= 0; })) return false;
          return t.filters.every(function (f) { var v = u.f[f[0]]; return !v || f[2] === skipField || nz(x[f[2]]) === nz(v); });
        });
      }
      function drawTabs() {
        document.querySelector('#v167-tabs').innerHTML = TABS.map(function (t) {
          return '<button class="btn ' + (t.id === active ? 'active' : 'secondary') + '" data-v167-tab="' + t.id + '">' + t.label + ' (' + data[t.id].length + ')</button>';
        }).join('');
        document.querySelectorAll('[data-v167-tab]').forEach(function (b) { b.onclick = function () { active = b.dataset.v167Tab; drawTabs(); drawBody(); }; });
      }
      function selectedCount() { return Object.keys(ui[active].selected).length; }
      function drawBody() {
        var t = tabById(active), u = ui[active], host = document.querySelector('#v167-body'), all = data[t.id];
        var cardField = t.card, base = filtered(t, cardField), counts = {};
        base.forEach(function (x) { var v = x[cardField]; if (v) counts[nz(v)] = (counts[nz(v)] || 0) + 1; });
        var labels = {}; all.forEach(function (x) { if (x[cardField]) labels[nz(x[cardField])] = x[cardField]; });
        var cur = u.f[cardField] ? nz(u.f[cardField]) : '';
        var total = all.reduce(function (s, x) { return s + moneyOf(x); }, 0);
        var cards = '<div class="cards compact v167-cards">'
          + '<div class="metric metric-clickable' + (!cur ? ' active' : '') + '" data-v167-card=""><strong>' + base.length + '</strong><span>📊 TOTAL</span></div>'
          + '<div class="metric"><strong id="v167-sel">' + selectedCount() + '</strong><span>☑️ SELECCIONADOS</span></div>'
          + Object.keys(labels).sort().map(function (k) { return '<div class="metric metric-clickable' + (cur === k ? ' active' : '') + '" data-v167-card="' + esc(labels[k]) + '"><strong>' + (counts[k] || 0) + '</strong><span>🏷️ ' + esc(labels[k]) + '</span></div>'; }).join('')
          + '<div class="metric"><strong>' + esc(money(total)) + '</strong><span>💰 VALOR TOTAL</span></div></div>';
        var toolbar = '<div class="toolbar v167-toolbar"><input id="v167-q" class="input search-field" placeholder="🔍 Buscar IMEI, responsable, zona..." value="' + esc(u.q) + '">'
          + t.filters.map(function (f) {
            var opts = Array.from(new Set(all.map(function (x) { return x[f[2]]; }).filter(function (v) { return v !== undefined && v !== null && String(v).trim() !== ''; }).map(String))).sort();
            return '<select class="select" data-v167-f="' + f[0] + '"><option value="">' + f[1] + '</option>' + opts.map(function (o) { return '<option' + (nz(o) === nz(u.f[f[0]]) && u.f[f[0]] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
          }).join('') + '<button class="btn secondary" id="v167-clear">✖ Limpiar filtros</button></div>';
        host.innerHTML = cards + toolbar + '<div id="v167-results"></div><div id="v167-pager"></div>';
        host.querySelectorAll('[data-v167-card]').forEach(function (c) {
          c.onclick = function () { var v = c.dataset.v167Card; u.f[cardField] = (v && nz(v) === cur) ? '' : v; u.page = 1; drawBody(); };
        });
        host.querySelector('#v167-q').oninput = function () { u.q = this.value; u.page = 1; drawRows(true); };
        host.querySelectorAll('[data-v167-f]').forEach(function (s) { s.onchange = function () { u.f[s.dataset.v167F] = s.value; u.page = 1; drawBody(); }; });
        host.querySelector('#v167-clear').onclick = function () { u.q = ''; u.f = {}; u.page = 1; drawBody(); };
        drawRows();
      }
      function drawRows(searchOnly) {
        var t = tabById(active), u = ui[active], out = filtered(t), size = 20, pages = Math.max(1, Math.ceil(out.length / size)), host = document.querySelector('#v167-results');
        u.page = Math.min(u.page, pages);
        var view = out.slice((u.page - 1) * size, u.page * size);
        var cell = function (x, k) {
          if (k === 'monto') return esc(money(moneyOf(x)));
          if (k === 'estado' || k === 'en_inventario') return badge(x[k]);
          if (k === 'tipo') return typeof badgeTipo === 'function' ? badgeTipo(x[k]) : esc(x[k]);
          if (k === 'tipo_uso') return typeof badgeTipoUso === 'function' ? badgeTipoUso(x[k]) : esc(x[k]);
          return esc(displayImportValue(x[k], k));
        };
        host.innerHTML = '<div class="table-wrap module-table"><table><thead><tr><th>✓</th>' + t.cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>'
          + (view.map(function (x, i) { var key = rowKey(t, x); return '<tr><td><input type="checkbox" data-v167-i="' + ((u.page - 1) * size + i) + '"' + (u.selected[key] ? ' checked' : '') + '></td>' + t.cols.map(function (c) { return '<td>' + cell(x, c[0]) + '</td>'; }).join('') + '</tr>'; }).join('') || '<tr><td colspan="' + (t.cols.length + 1) + '" class="empty">Sin registros</td></tr>') + '</tbody></table></div>';
        host.querySelectorAll('[data-v167-i]').forEach(function (c) {
          c.onchange = function () { var row = out[Number(c.dataset.v167I)], key = rowKey(t, row); if (c.checked) u.selected[key] = row; else delete u.selected[key]; document.querySelector('#v167-sel').textContent = selectedCount(); };
        });
        window.lduRenderPager && window.lduRenderPager(document.querySelector('#v167-pager'), u.page, out.length, size, function (p) { u.page = p; drawRows(); });
        var totalCard = document.querySelector('[data-v167-card=""] strong'); if (totalCard && searchOnly) totalCard.textContent = out.length;
      }
      function drawHistory() {
        var pages = Math.max(1, Math.ceil(deleted.length / DEL_SIZE)); delPage = Math.min(delPage, pages);
        var slice = deleted.slice((delPage - 1) * DEL_SIZE, delPage * DEL_SIZE);
        document.querySelector('#v167-hist').innerHTML = table(slice, ['eliminado_en', 'eliminado_por', 'imei', 'modulo', 'motivo']);
        window.lduRenderPager && window.lduRenderPager(document.querySelector('#v167-hist-pager'), delPage, deleted.length, DEL_SIZE, function (p) { delPage = p; drawHistory(); });
      }

      document.querySelector('#v167-refresh').onclick = function () { window.renderDelete(); };
      document.querySelector('#v167-all').onclick = function () {
        document.querySelectorAll('#v167-results [data-v167-i]').forEach(function (c) { if (!c.checked) { c.checked = true; c.onchange(); } });
      };
      document.querySelector('#v167-delete').onclick = function () {
        var t = tabById(active), sel = Object.keys(ui[active].selected).map(function (k) { return ui[active].selected[k]; });
        if (!sel.length) return alert('Selecciona al menos un registro en ' + t.label.replace(/^\S+\s/, '') + '.');
        var modal = document.createElement('div'); modal.className = 'drawer';
        modal.innerHTML = '<aside class="drawer-card v26-confirm-card"><div class="section-head"><h2>⚠️ Confirmación de eliminación</h2><button class="btn secondary" id="v167-x">✕</button></div><p>Se eliminarán <b>' + sel.length + '</b> registro' + (sel.length === 1 ? '' : 's') + ' de <b>' + esc(t.label.replace(/^\S+\s/, '')) + '</b>. Esta acción no se puede deshacer.</p><label>Justificación de la eliminación:</label><textarea id="v167-reason" class="input" rows="4" required></textarea><div class="form-actions"><button class="btn secondary" id="v167-cancel">Cancelar</button><button class="btn danger" id="v167-confirm">Confirmar eliminación</button></div></aside>';
        document.body.appendChild(modal);
        var close = function () { modal.remove(); };
        modal.querySelector('#v167-x').onclick = close; modal.querySelector('#v167-cancel').onclick = close;
        modal.querySelector('#v167-confirm').onclick = async function () {
          var reason = modal.querySelector('#v167-reason').value.trim();
          if (!reason) return alert('La justificación es obligatoria.');
          this.disabled = true;
          var fails = [];
          for (var i = 0; i < sel.length; i++) {
            var x = sel[i];
            try {
              var r = t.kind === 'stock' ? await api('deleteStock', { imei: x.imei, justification: reason, userId: lduUserId() })
                : t.kind === 'incident' ? await api('deleteIncident', { id_incidencia: x.id_incidencia, imei: x.imei_original || x.imei, tipo: x.tipo, justification: reason, userId: lduUserId() })
                : await api('deleteDevice', { imei: x.imei, justification: reason, userId: lduUserId() });
              if (r && r.status === 'error') throw new Error(r.message);
            } catch (e) { fails.push(x.imei + ': ' + (e.message || e)); }
          }
          close(); state.imeiNoVivo = null;
          if (fails.length) alert('No se pudieron eliminar ' + fails.length + ' registro(s):\n' + fails.slice(0, 10).join('\n'));
          window.renderDelete();
        };
      };
      drawTabs(); drawBody(); drawHistory();
    } catch (e) { errorView('No se pudo cargar Eliminar', e, 'renderDelete'); }
  };
  var st = document.createElement('style');
  st.textContent = '.v167-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:14px 18px}.v167-cards .metric.active{border-color:var(--blue);box-shadow:0 0 0 2px #415fff33;background:#f3f6ff}.v167-tabs{padding:0 18px;flex-wrap:wrap}.v167-toolbar{padding:0 18px}.v167-delete .table-wrap{margin:0 18px 8px!important}#v167-pager,#v167-hist-pager{padding:0 18px 12px}#v167-hist{padding:0 18px}#v167-hist table{min-width:700px}';
  document.head.appendChild(st);
}());
