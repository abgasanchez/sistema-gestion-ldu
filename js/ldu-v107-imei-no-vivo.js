/* v107: módulo completo "IMEI NO VIVO" — a partir de ahora LDU_IMEI_No_Vivo es una hoja real
 * del sistema (config.gs), no un cálculo en memoria. Este archivo agrega:
 *   1) Un ítem de navegación nuevo ("Módulos" → IMEI NO VIVO, junto a Modelos Ant. B).
 *   2) La pantalla del módulo (renderImeiNoVivo): tarjetas, buscador, filtros, tabla y
 *      paginación — mismo patrón que Inventario LDU (renderDevices, js/final-v23.js).
 *   3) Alta/edición/eliminación conectadas al backend real: editar/eliminar reutilizan
 *      'updateDevice'/'deleteDevice' (ya reconocen esta hoja, ver device-service.gs); el alta
 *      nueva usa la acción dedicada 'createImeiNoVivo' (el modelo no clasifica esta hoja).
 *   4) La sección "📈 Estados — IMEI NO VIVO" del Dashboard, después de ⚠️ Incidencias, con el
 *      mismo patrón de botones (Exportar / Ver módulo) que "📈 Estados — 🟧 Modelos Antiguos B".
 * Todo esto vive en su propio archivo (separado de ldu-v106-mejoras.js) para poder revertirse
 * de forma independiente si hace falta. */
(function () {
  'use strict';

  var N = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var I = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };

  /* ---------------------------------------------------------------------
   * 1) Ítem de navegación (junto a "Modelos Ant. B")
   * ------------------------------------------------------------------- */
  (function registerNavItem() {
    if (typeof LDU_NAV === 'undefined') return;
    var modulos = LDU_NAV.find(function (g) { return g[0] === 'Módulos'; });
    if (!modulos) return;
    var items = modulos[1];
    if (items.some(function (it) { return it[0] === 'imeiNoVivo'; })) return;
    var bIndex = items.findIndex(function (it) { return it[0] === 'modelB'; });
    items.splice(bIndex >= 0 ? bIndex + 1 : items.length, 0, ['imeiNoVivo', '📵', 'IMEI NO VIVO']);
  }());

  var baseNavigate107_ = window.navigate;
  window.navigate = navigate = function (view) {
    if (view === 'imeiNoVivo') {
      state.view = view;
      setTitle('IMEI NO VIVO');
      renderImeiNoVivo();
      return;
    }
    return baseNavigate107_(view);
  };

  /* ---------------------------------------------------------------------
   * 2) Tarjetas — cálculo directo sobre las filas (no hay Stock que cruzar:
   *    estar en esta hoja YA significa "sin Stock asociado").
   * ------------------------------------------------------------------- */
  function imeiNoVivoCards(rows) {
    var byState = function (s) { return rows.filter(function (r) { return N(r.estado) === N(s); }).length; };
    var valor = rows.reduce(function (a, r) { var n = Number(String(r.monto != null && r.monto !== '' ? r.monto : r.valor || 0).replace(/[^0-9.-]/g, '')); return a + (isFinite(n) ? n : 0); }, 0);
    return card('📊 TOTAL', rows.length)
      + card('✅ ACTIVOS', byState('Activo'))
      + card('🏬 ALMACÉN', byState('Almacén'))
      + card('💥 DAÑADOS', byState('Dañado'))
      + card('🔧 REPARACIÓN', byState('En Reparación'))
      + card('🔎 PERDIDOS', byState('Perdido'))
      + card('⛔ BAJA', byState('Baja'))
      + card('📦 PEND. DEVOLUCIÓN', byState('Pendiente Devolución'))
      + card('↩️ DEVUELTOS', byState('Devuelto'))
      + card('💰 VALOR TOTAL', money(valor));
  }

  /* ---------------------------------------------------------------------
   * 3) Formulario de alta nueva (edición reutiliza openDeviceForm tal cual,
   *    porque updateDevice_ ya reconoce esta hoja).
   * ------------------------------------------------------------------- */
  function openImeiNoVivoForm(existing) {
    existing = existing || {};
    if (existing.id_dispositivo) { openDeviceForm(existing); return; }
    var drawer = document.createElement('div'); drawer.className = 'drawer';
    drawer.innerHTML = '<aside class="drawer-card device-form-card"><div class="section-head"><h2>📵 Nuevo IMEI NO VIVO</h2><button type="button" class="btn secondary" id="nv-x">✕</button></div><form class="device-form" id="nv-device-form"><h3>🪪 Identificación</h3><div class="form-grid">'
      + field('IMEI *', 'imei', 'text', '', 'required minlength="15" maxlength="17"')
      + selectField('Estado', 'estado', LDU_STATES, 'Activo')
      + field('Marca', 'marca', 'text', 'VIVO')
      + field('Modelo', 'modelo', 'text', '')
      + field('N° Línea', 'n_linea', 'text', '')
      + field('Monto S/ *', 'monto', 'number', '', 'required min="0.01" step="0.01"')
      + '</div><h3>👤 Responsable</h3><div class="form-grid">'
      + field('Nombre completo', 'responsable', 'text', '')
      + field('DNI', 'dni', 'text', '')
      + field('Cargo', 'cargo', 'text', '')
      + selectField('Tipo', 'tipo', LDU_TYPES, '')
      + field('Supervisor', 'supervisor', 'text', '')
      + '</div><h3>📍 Ubicación</h3><div class="form-grid">'
      + field('Zona', 'zona', 'text', '')
      + field('Departamento', 'departamento', 'text', '')
      + field('Ciudad', 'ciudad', 'text', '')
      + field('Cuenta', 'cuenta', 'text', '')
      + field('Canal', 'canal', 'text', '')
      + field('Tienda', 'tienda', 'text', '')
      + '</div><h3>📋 Asignación</h3><div class="form-grid">'
      + selectField('Tipo de Uso', 'tipo_uso', LDU_USES, '')
      + field('F. Asignación', 'fecha_asignacion', 'date', '')
      + '<label class="full-field"><span>Observaciones</span><textarea class="input" name="observaciones"></textarea></label>'
      + '</div><div id="nv-msg"></div><div class="form-actions"><button type="button" class="btn secondary" id="nv-cancel">Cancelar</button><button class="btn" type="submit">💾 Guardar</button></div></form></aside>';
    document.body.appendChild(drawer);
    var form = drawer.querySelector('form'), close = function () { drawer.remove(); };
    drawer.querySelector('#nv-x').onclick = close;
    drawer.querySelector('#nv-cancel').onclick = close;
    form.onsubmit = async function (e) {
      e.preventDefault();
      var msg = drawer.querySelector('#nv-msg'); msg.textContent = 'Guardando...';
      var device = Object.fromEntries(new FormData(form).entries());
      try {
        var r = await api('createImeiNoVivo', { device: device, userId: lduUserId() });
        if (r.status !== 'ok') throw new Error(r.message);
        close();
        state.imeiNoVivo = null;
        navigate('imeiNoVivo');
      } catch (err) { msg.textContent = err.message; }
    };
  }

  /* ---------------------------------------------------------------------
   * 4) Pantalla del módulo — mismo patrón que Inventario LDU: tarjetas,
   *    buscador, filtros, tabla con LDU_COLS y paginación.
   * ------------------------------------------------------------------- */
  var NV_PAGE_SIZE = 20;
  var NV_FILTERS = [['supervisor', 'SUPERVISOR'], ['zona', 'ZONA'], ['cuenta', 'CUENTA'], ['modelo', 'MODELO'], ['tipo', 'TIPO'], ['tipo_uso', 'TIPO USO'], ['estado', 'ESTADO']];

  window.renderImeiNoVivo = async function () {
    loading('Cargando IMEI NO VIVO...');
    try {
      var r = await api('listImeiNoVivo');
      var rows = r.data || [];
      state.imeiNoVivo = rows;
      var page = { value: 1 }, currentOut = rows;
      var optionsHtml = NV_FILTERS.map(function (f) {
        var seen = {}, list = [];
        rows.map(function (x) { return x[f[0]]; }).filter(Boolean).forEach(function (v) {
          var k = N(v);
          if (seen[k]) return;
          seen[k] = true; list.push(v);
        });
        list.sort();
        return '<select id="nv-f-' + f[0] + '" class="select"><option value="">' + f[1] + '</option>' + list.map(function (v) { return '<option value="' + safe(v) + '">' + safe(String(v).toUpperCase()) + '</option>'; }).join('') + '</select>';
      }).join('');
      document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>📵 IMEI NO VIVO</h2><div><button type="button" class="btn secondary" id="nv-refresh">🔄 Actualizar</button><button type="button" class="btn secondary" id="nv-export">📤 Exportar</button><button type="button" class="btn" id="nv-new">＋ Nuevo</button></div></div>'
        + '<div class="cards compact module-cards" id="nv-cards"></div>'
        + '<div class="toolbar module-filters"><input id="nv-q" class="input search-field" placeholder="🔍 Buscar IMEI, nombre, modelo...">' + optionsHtml + '</div>'
        + '<div class="table-wrap module-table"><table><thead><tr>' + LDU_COLS.map(function (f) { return '<th>' + f[1] + '</th>'; }).join('') + '<th>ACCIONES</th></tr></thead><tbody id="nv-body"></tbody></table><div id="nv-pager"></div></div>'
        + '</section>';
      document.querySelector('#nv-refresh').onclick = function () { state.imeiNoVivo = null; renderImeiNoVivo(); };
      document.querySelector('#nv-new').onclick = function () { openImeiNoVivoForm(); };
      document.querySelector('#nv-export').onclick = function () { exportRows(currentOut, 'imei-no-vivo', LDU_DEVICE_EXPORT_FIELDS); };
      function draw() {
        var q = N(document.querySelector('#nv-q').value);
        var out = rows.filter(function (x) {
          return (!q || Object.values(x).some(function (v) { return N(v).indexOf(q) >= 0; }))
            && NV_FILTERS.every(function (f) { var el = document.querySelector('#nv-f-' + f[0]); return !el.value || N(x[f[0]]) === N(el.value); });
        });
        currentOut = out;
        page.value = Math.min(page.value, Math.max(1, Math.ceil(out.length / NV_PAGE_SIZE)));
        document.querySelector('#nv-cards').innerHTML = imeiNoVivoCards(out);
        var pageRows = out.slice((page.value - 1) * NV_PAGE_SIZE, page.value * NV_PAGE_SIZE);
        document.querySelector('#nv-body').innerHTML = pageRows.map(function (x) {
          return '<tr>' + LDU_COLS.map(function (f) {
            if (f[0] === 'estado') return '<td>' + badge(x.estado) + '</td>';
            if (f[0] === 'monto') return '<td>' + safe(money(x.monto)) + '</td>';
            return '<td>' + safe(displayImportValue(x[f[0]], f[0])) + '</td>';
          }).join('') + '<td class="row-actions">'
            + '<button type="button" data-nv="view" data-id="' + safe(x.imei) + '">👁️</button>'
            + '<button type="button" data-nv="history" data-id="' + safe(x.imei) + '">📜</button>'
            + '<button type="button" data-nv="edit" data-id="' + safe(x.imei) + '">✎️</button>'
            + '<button type="button" data-nv="delete" data-id="' + safe(x.imei) + '">🗑️</button>'
            + '</td></tr>';
        }).join('') || '<tr><td colspan="' + (LDU_COLS.length + 1) + '" class="empty">SIN RESULTADOS</td></tr>';
        document.querySelectorAll('[data-nv]').forEach(function (b) {
          b.onclick = function () {
            var x = out.find(function (y) { return I(y.imei) === I(b.dataset.id); });
            if (!x) return;
            var act = b.dataset.nv;
            if (act === 'view') showDetail(x);
            if (act === 'history') { state.historyImei = x.imei; navigate('history'); }
            if (act === 'edit') openDeviceForm(x);
            if (act === 'delete' && confirm('¿Enviar este registro al módulo Eliminar?')) {
              api('deleteDevice', { imei: x.imei, justification: 'Eliminación desde IMEI NO VIVO', userId: lduUserId() }).then(function () { state.imeiNoVivo = null; renderImeiNoVivo(); });
            }
          };
        });
        if (window.lduRenderPager) window.lduRenderPager(document.querySelector('#nv-pager'), page.value, out.length, NV_PAGE_SIZE, function (p) { page.value = p; draw(); });
      }
      document.querySelector('#nv-q').oninput = function () { page.value = 1; draw(); };
      NV_FILTERS.forEach(function (f) { document.querySelector('#nv-f-' + f[0]).onchange = function () { page.value = 1; draw(); }; });
      draw();
    } catch (e) { errorView('No se pudo cargar IMEI NO VIVO', e, 'renderImeiNoVivo'); }
  };

  /* ---------------------------------------------------------------------
   * 5) Sección del Dashboard, después de ⚠️ Incidencias — mismo patrón de
   *    botones (Exportar / Ver módulo) que "Estados — Modelos Antiguos B".
   * ------------------------------------------------------------------- */
  function noVivoSectionHtml(rows) {
    return '<section class="section dashboard-module novivo" id="ldu-imeinovivo-section"><div class="section-head"><h2>📈 Estados — IMEI NO VIVO</h2><div class="dashboard-actions">'
      + '<button type="button" class="btn secondary" onclick="exportRows(state.imeiNoVivo||[],\'imei-no-vivo\',LDU_DEVICE_EXPORT_FIELDS)">📤 Exportar</button>'
      + '<button type="button" class="btn secondary" onclick="navigate(\'imeiNoVivo\')">📋 Ver módulo</button>'
      + '</div></div>' + '<div class="cards compact">' + imeiNoVivoCards(rows || []) + '</div></section>';
  }

  function ensureNoVivoDashboardSection() {
    var incSection = document.querySelector('#app .dashboard-incidents');
    if (!incSection) return;
    /* Guardia obligatoria: insertar la sección dispara otra mutación de #app (childList), que
     * volvería a llamar a esta misma función — sin este chequeo, cada mutación insertaría una
     * sección nueva más, en bucle infinito (ver el mismo problema ya corregido una vez en
     * ldu-v106-mejoras.js). */
    var next = incSection.nextElementSibling;
    if (next && next.id === 'ldu-imeinovivo-section') return;
    incSection.insertAdjacentHTML('afterend', noVivoSectionHtml(Array.isArray(state.imeiNoVivo) ? state.imeiNoVivo : []));
    if (!Array.isArray(state.imeiNoVivo)) {
      api('listImeiNoVivo').then(function (r) {
        state.imeiNoVivo = (r && r.data) || [];
        var section = document.querySelector('#ldu-imeinovivo-section .cards');
        if (section) section.innerHTML = imeiNoVivoCards(state.imeiNoVivo);
      }).catch(function () { state.imeiNoVivo = state.imeiNoVivo || []; });
    }
  }

  var appHost107_ = document.querySelector('#app');
  if (appHost107_) new MutationObserver(ensureNoVivoDashboardSection).observe(appHost107_, { childList: true });
  document.addEventListener('DOMContentLoaded', ensureNoVivoDashboardSection);
  setTimeout(ensureNoVivoDashboardSection, 300);
}());
