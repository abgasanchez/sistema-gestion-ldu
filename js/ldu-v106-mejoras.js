/* v106: mejoras solicitadas — Exportador General (Dashboard y Stock) en un solo archivo Excel
 * con varias hojas, y un reintento silencioso para lecturas ante fallas transitorias de Apps
 * Script (timeout/red), reduciendo los "No se pudo conectar con Apps Script" que se resuelven
 * solos en el segundo intento. No reemplaza ninguna función existente por completo: se apoya
 * en lo que ya expone el sistema (state, api, groupFor, exportRows, badge, money, safe,
 * displayImportValue, window.lduReconcile) y solo agrega HTML/botones nuevos vía DOM. */
(function () {
  'use strict';

  var N = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var I = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
  var G = function (m) { return typeof groupFor === 'function' ? groupFor(m) : 'INVENTARIO'; };

  /* v109: BUG — los exportadores confiaban en state.devices/state.stock/state.incidents ya
   * cargados en memoria por lo que sea que se haya renderizado antes (Dashboard o Stock), y
   * noVivoDevices() cacheaba el resultado de listImeiNoVivo INCLUSO CUANDO HABÍA FALLADO
   * (state.imeiNoVivo quedaba en [] tras un error transitorio, y como [] sigue siendo un
   * array, la comprobación "if (Array.isArray(...))" nunca volvía a intentar la llamada) —
   * cualquiera de los dos motivos deja una o más hojas del Excel vacías sin que haya pasado
   * nada raro con los datos reales del Sheet. Ahora ambos exportadores piden los 4 listados
   * DIRECTO al backend en el momento de exportar, sin depender de qué haya quedado en
   * memoria ni de un caché que pueda haberse quedado pegado en vacío. */
  async function fetchExportData_() {
    /* v110: BUG — Apps Script nunca "lanza" un error HTTP para un fallo de negocio (permiso,
     * hoja inexistente, etc.): siempre responde 200 con {status:'error', data:null, message}.
     * api() resuelve esa respuesta normalmente (no la rechaza), así que "r[i].data || []" la
     * convertía en un array vacío EN SILENCIO — el Excel salía "vacío" sin ningún aviso de que
     * en realidad hubo un error de backend (p. ej. LDU_IMEI_No_Vivo todavía no existe porque no
     * se corrió 'setup', o el rol de la sesión no tiene permiso). Ahora cada respuesta se
     * revisa explícitamente y, si alguna falló, se corta el export con un mensaje que dice
     * CUÁL falló y por qué, en vez de seguir con datos vacíos como si nada. */
    var labels = ['Inventario/Modelos A/B', 'Incidencias', 'Stock', 'IMEI NO VIVO'];
    var actions = ['listDevices', 'listIncidents', 'listStock', 'listImeiNoVivo'];
    var results = await Promise.all(actions.map(function (a) {
      return api(a).catch(function (e) { return { status: 'error', message: (e && e.message) || 'No se pudo conectar.' }; });
    }));
    var errors = [];
    results.forEach(function (r, i) { if (!r || r.status !== 'ok') errors.push(labels[i] + ' (' + actions[i] + '): ' + ((r && r.message) || 'sin respuesta válida')); });
    if (errors.length) throw new Error(errors.join(' | '));
    return { devices: results[0].data || [], incidents: results[1].data || [], stock: results[2].data || [], noVivo: results[3].data || [] };
  }

  /* ---------------------------------------------------------------------
   * 2) Exportador General — Dashboard (varias hojas en un solo Excel)
   * ------------------------------------------------------------------- */
  function buildSheetRows(rows, fields, getter) {
    getter = getter || function (r, k) { return r[k]; };
    return (rows || []).map(function (r) {
      var out = {};
      fields.forEach(function (f) { var v = displayImportValue(getter(r, f[0]), f[0]); out[f[1]] = v == null ? '' : v; });
      return out;
    });
  }
  /* v108: BUG — XLSX.utils.json_to_sheet([]) sobre un array vacío devuelve una hoja SIN
   * encabezados ni rango (`!ref`), que Excel muestra como una pestaña completamente en blanco
   * — parecía que "la hoja salía vacía" (por error) cuando en realidad solo no había filas para
   * ese grupo en ese momento. Ahora, sin filas, se arma la hoja con al menos la fila de
   * encabezados (mismos títulos que ve el usuario en pantalla), para que quede claro que la
   * hoja SÍ se generó pero no hay datos, no que algo se rompió. */
  function sheetFromRows(rows, fields, getter) {
    if (!rows || !rows.length) return XLSX.utils.aoa_to_sheet([fields.map(function (f) { return f[1]; })]);
    return XLSX.utils.json_to_sheet(buildSheetRows(rows, fields, getter));
  }
  var INCIDENT_EXPORT_FIELDS_ = [
    ['imei_original', 'IMEI ORIGINAL'], ['tipo', 'TIPO'], ['imei_nuevo', 'IMEI NUEVO'],
    ['nombre_completo', 'NOMBRE COMPLETO'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['zona', 'ZONA'],
    ['supervisor', 'SUPERVISOR'], ['modelo', 'MODELO'], ['fecha_incidente', 'FECHA DEL INCIDENTE'],
    ['tipo_uso', 'TIPO USO'], ['valor', 'VALOR S/'], ['doc_autorizacion', 'DOC. AUTORIZACIÓN'],
    ['modalidad', 'MODALIDAD'], ['estado_proceso', 'ESTADO PROCESO'], ['documentos_adjuntos', 'DOCUMENTOS ADJUNTOS']
  ];
  /* v108: BUG — se leía r[f[0]] tal cual, pero varias columnas de Incidencias tienen alias
   * reales (nombre_completo puede venir como responsable/nombre, valor como monto, etc. —
   * mismo criterio que incidentValue98_ en active-fixes-v98.js) — sin esto, esas columnas
   * salían en blanco en el Excel aunque la fila sí tuviera el dato bajo el nombre alterno. */
  function incidentGetter_(r, k) {
    if (r[k] !== undefined && r[k] !== '') return r[k];
    if (k === 'nombre_completo') return r.responsable || r.nombre || '';
    if (k === 'documentos_adjuntos') return r.doc_adjunto || r.documentos || '';
    if (k === 'modalidad') return r.modality || '';
    if (k === 'estado_proceso') return r.estadoProceso || r.estadoproceso || '';
    if (k === 'valor') return r.monto || '';
    return '';
  }

  /* v108: hoja "Resumen Dashboard" rediseñada como un informe real (título, fecha de
   * generación, indicadores generales e una tabla de resumen por modelo combinando
   * Inventario/Modelos A/B contra Stock) en vez de una lista plana MÉTRICA/VALOR — pedido
   * explícito del usuario, con un ejemplo de formato como referencia. */
  function modelSummaryRows_() {
    var devices = state.devices || [], stock = state.stock || [];
    var models = Array.from(new Set(devices.concat(stock).map(function (r) { return r.modelo; }).filter(Boolean))).sort();
    return models.map(function (model) {
      var inv = devices.filter(function (d) { return N(d.modelo) === N(model); });
      var st = stock.filter(function (s) { return N(s.modelo) === N(model); });
      var byEstado = function (name) { return inv.filter(function (d) { return N(d.estado) === N(name); }).length; };
      return [model, st.length, inv.length, byEstado('Activo'), byEstado('Dañado'), byEstado('En Reparación'), byEstado('Perdido'), byEstado('Baja'), byEstado('Pendiente Devolución'), byEstado('Devuelto'), Math.max(0, st.length - inv.length)];
    });
  }
  function buildResumenDashboardSheet_(devices, incidents, t) {
    var rows = [
      ['INFORME DASHBOARD - SISTEMA LDU'],
      ['Generado:', new Date().toLocaleString('es-PE')],
      [],
      ['INDICADORES GENERALES'],
      ['Total dispositivos', devices.length + (state.imeiNoVivo || []).length],
      ['Activos', t.act || 0],
      ['Dañados', t.dan || 0],
      ['En Reparación', t.rep || 0],
      ['Perdidos', t.per || 0],
      ['Baja', t.baja || 0],
      ['IMEI NO VIVO', (state.imeiNoVivo || []).length],
      ['Incidencias registradas', incidents.length],
      [],
      ['RESUMEN POR MODELO'],
      ['Modelo', 'Stock', 'Total Inv.', 'Activos', 'Dañados', 'Reparación', 'Perdidos', 'Baja', 'Pend.Dev', 'Devuelto', 'Faltante']
    ].concat(modelSummaryRows_());
    return XLSX.utils.aoa_to_sheet(rows);
  }

  async function exportDashboardGeneral() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    var btn = document.querySelector('#ldu-export-general-dash');
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = '⏳ Generando...'; }
    try {
      var data = await fetchExportData_();
      state.devices = data.devices; state.incidents = data.incidents; state.stock = data.stock; state.imeiNoVivo = data.noVivo;
      var inventario = data.devices.filter(function (d) { return G(d.modelo) === 'INVENTARIO'; });
      var modelA = data.devices.filter(function (d) { return G(d.modelo) === 'A'; });
      var modelB = data.devices.filter(function (d) { return G(d.modelo) === 'B'; });
      var t = (typeof totals === 'function') ? totals(data.devices) : {};
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, buildResumenDashboardSheet_(data.devices, data.incidents, t), 'Resumen Dashboard');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.devices, LDU_DEVICE_EXPORT_FIELDS), 'General');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(inventario, LDU_DEVICE_EXPORT_FIELDS), 'Inventario LDU');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.incidents, INCIDENT_EXPORT_FIELDS_, incidentGetter_), 'Incidencias');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(modelA, LDU_DEVICE_EXPORT_FIELDS), 'Modelos Ant. A');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(modelB, LDU_DEVICE_EXPORT_FIELDS), 'Modelos Ant. B');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.noVivo, LDU_DEVICE_EXPORT_FIELDS), 'IMEI NO VIVO');
      XLSX.writeFile(wb, 'LDU_Reporte_General.xlsx');
    } catch (e) {
      alert('No se pudo generar el Excel: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || '📊 Exportador General'; }
    }
  }
  window.exportDashboardGeneral = exportDashboardGeneral;

  function ensureDashboardExportButton() {
    var toolbar = document.querySelector('#app .dashboard-toolbar');
    if (!toolbar || toolbar.querySelector('#ldu-export-general-dash')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn secondary'; btn.id = 'ldu-export-general-dash';
    btn.textContent = '📊 Exportador General';
    btn.onclick = exportDashboardGeneral;
    toolbar.appendChild(btn);
  }

  /* ---------------------------------------------------------------------
   * 3) Exportador General — Stock (Stock Inventario/A/B + IMEI NO VIVO)
   * ------------------------------------------------------------------- */
  function stockGroup_(r) {
    var s = N(r.hoja_origen || r.source_sheet || '');
    if (s.indexOf('STOCK_A') >= 0) return 'A';
    if (s.indexOf('STOCK_B') >= 0) return 'B';
    return G(r.modelo);
  }
  async function exportStockGeneral() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    var btn = document.querySelector('#ldu-export-general-stock');
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = '⏳ Generando...'; }
    try {
      var data = await fetchExportData_();
      state.devices = data.devices; state.incidents = data.incidents; state.stock = data.stock; state.imeiNoVivo = data.noVivo;
      var reconciled = window.lduReconcile ? window.lduReconcile(data.devices, data.stock) : { deviceBy: {} };
      var mapped = data.stock.map(function (r) {
        var d = reconciled.deviceBy[I(r.imei)] || {};
        return Object.assign({}, r, {
          inventario: d.imei ? 'EN INVENTARIO' : 'NO EN INVENTARIO',
          estado: d.imei ? (d.estado || d.estado_inventario) : (r.estado_inventario || r.estado)
        });
      });
      var byGroup = function (g) { return mapped.filter(function (r) { return stockGroup_(r) === g; }); };
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('INVENTARIO'), LDU_STOCK_EXPORT_FIELDS), 'Stock Inventario');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('A'), LDU_STOCK_EXPORT_FIELDS), 'Stock Modelos A');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('B'), LDU_STOCK_EXPORT_FIELDS), 'Stock Modelos B');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.noVivo, LDU_DEVICE_EXPORT_FIELDS), 'IMEI NO VIVO');
      XLSX.writeFile(wb, 'LDU_Stock_Reporte_General.xlsx');
    } catch (e) {
      alert('No se pudo generar el Excel: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || '📤 Exportador General'; }
    }
  }
  window.exportStockGeneral = exportStockGeneral;

  function ensureStockExportButton() {
    var head = document.querySelector('#app .stock-screen .section-head div');
    if (!head || head.querySelector('#ldu-export-general-stock')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn secondary'; btn.id = 'ldu-export-general-stock';
    btn.textContent = '📤 Exportador General';
    btn.onclick = exportStockGeneral;
    head.appendChild(btn);
  }

  /* ---------------------------------------------------------------------
   * 4) Enganche de UI: se re-evalúa cada vez que #app cambia de contenido
   *    completo (navegación/actualización), no en cada tecla de búsqueda.
   * ------------------------------------------------------------------- */
  function ensureExtraUi() {
    ensureDashboardExportButton();
    ensureStockExportButton();
  }
  var appHost = document.querySelector('#app');
  if (appHost) new MutationObserver(ensureExtraUi).observe(appHost, { childList: true });
  document.addEventListener('DOMContentLoaded', ensureExtraUi);
  setTimeout(ensureExtraUi, 300);

  /* ---------------------------------------------------------------------
   * 5) Estabilidad de conexión con Apps Script: un reintento silencioso
   *    para acciones de solo lectura cuando la falla es transitoria
   *    (timeout de 45s o corte de red), antes de mostrar el error al
   *    usuario. No se reintentan acciones de escritura (crear/editar/
   *    eliminar/importar) para no arriesgar una doble ejecución.
   * ------------------------------------------------------------------- */
  var RETRYABLE_READS_ = { health: 1, getSnapshot: 1, listDevices: 1, listStock: 1, listImeiNoVivo: 1, listIncidents: 1, listHistory: 1, listUsers: 1, listNotifications: 1, lookupImei: 1, getGrupo: 1, listDeleted: 1 };
  function isTransientError_(err) {
    var m = (err && err.message) || '';
    return /no respondi|No se pudo conectar|Failed to fetch|network|NetworkError/i.test(m);
  }
  var priorApi106_ = window.api;
  if (typeof priorApi106_ === 'function') {
    window.api = api = async function (action, payload) {
      try {
        return await priorApi106_(action, payload);
      } catch (err) {
        if (RETRYABLE_READS_[action] && isTransientError_(err)) {
          await new Promise(function (r) { setTimeout(r, 900); });
          return await priorApi106_(action, payload);
        }
        throw err;
      }
    };
  }
}());
