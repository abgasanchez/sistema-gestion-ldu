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

  /* v107: IMEI NO VIVO ya es una hoja real (LDU_IMEI_No_Vivo) con su propio módulo — se
   * consulta con 'listImeiNoVivo' en vez de calcularse en memoria (Inventario menos Stock),
   * que dejó de tener sentido una vez migrados esos dispositivos fuera de Inventario/Modelos
   * A/B (ver MIGRAR_IMEI_NO_VIVO_V107 en repository.gs). Se cachea en state.imeiNoVivo para
   * no repetir la llamada si ya se cargó el módulo/la sección del Dashboard en esta sesión. */
  async function noVivoDevices() {
    if (Array.isArray(state.imeiNoVivo)) return state.imeiNoVivo;
    try {
      var r = await api('listImeiNoVivo');
      state.imeiNoVivo = (r && r.data) || [];
    } catch (e) { state.imeiNoVivo = []; }
    return state.imeiNoVivo;
  }

  /* ---------------------------------------------------------------------
   * 2) Exportador General — Dashboard (varias hojas en un solo Excel)
   * ------------------------------------------------------------------- */
  function buildSheetRows(rows, fields) {
    return (rows || []).map(function (r) {
      var out = {};
      fields.forEach(function (f) { var v = displayImportValue(r[f[0]], f[0]); out[f[1]] = v == null ? '' : v; });
      return out;
    });
  }
  var INCIDENT_EXPORT_FIELDS_ = [
    ['imei_original', 'IMEI ORIGINAL'], ['tipo', 'TIPO'], ['imei_nuevo', 'IMEI NUEVO'],
    ['nombre_completo', 'NOMBRE COMPLETO'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['zona', 'ZONA'],
    ['supervisor', 'SUPERVISOR'], ['modelo', 'MODELO'], ['fecha_incidente', 'FECHA DEL INCIDENTE'],
    ['tipo_uso', 'TIPO USO'], ['valor', 'VALOR S/'], ['doc_autorizacion', 'DOC. AUTORIZACIÓN'],
    ['modalidad', 'MODALIDAD'], ['estado_proceso', 'ESTADO PROCESO'], ['documentos_adjuntos', 'DOCUMENTOS ADJUNTOS']
  ];

  async function exportDashboardGeneral() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    var devices = state.devices || [], incidents = state.incidents || [], stock = state.stock || [];
    var inventario = devices.filter(function (d) { return G(d.modelo) === 'INVENTARIO'; });
    var modelA = devices.filter(function (d) { return G(d.modelo) === 'A'; });
    var modelB = devices.filter(function (d) { return G(d.modelo) === 'B'; });
    var noVivo = await noVivoDevices();
    var t = (typeof totals === 'function') ? totals(devices) : {};
    var summary = [
      { METRICA: 'TOTAL STOCK', VALOR: t.stock || 0 }, { METRICA: 'TOTAL EN INVENTARIO', VALOR: t.enInv || 0 },
      { METRICA: 'TOTAL ACTIVOS', VALOR: t.act || 0 }, { METRICA: 'TOTAL EN ALMACÉN', VALOR: t.alm || 0 },
      { METRICA: 'TOTAL DAÑADOS', VALOR: t.dan || 0 }, { METRICA: 'TOTAL EN REPARACIÓN', VALOR: t.rep || 0 },
      { METRICA: 'TOTAL PERDIDOS', VALOR: t.per || 0 }, { METRICA: 'TOTAL EN BAJA', VALOR: t.baja || 0 },
      { METRICA: 'PENDIENTE DE DEVOLUCIÓN', VALOR: t.pdev || 0 }, { METRICA: 'TOTAL DEVUELTOS', VALOR: t.dev || 0 },
      { METRICA: 'TOTAL IMEI NO VIVO', VALOR: noVivo.length }, { METRICA: 'TOTAL IMEI NO INVENTARIO', VALOR: t.noInv || 0 },
      { METRICA: 'VALOR TOTAL', VALOR: money(t.valor || 0) }, { METRICA: '', VALOR: '' },
      { METRICA: 'INVENTARIO LDU — TOTAL DISPOSITIVOS', VALOR: inventario.length },
      { METRICA: 'MODELOS ANT. A — TOTAL DISPOSITIVOS', VALOR: modelA.length },
      { METRICA: 'MODELOS ANT. B — TOTAL DISPOSITIVOS', VALOR: modelB.length },
      { METRICA: 'INCIDENCIAS — TOTAL', VALOR: incidents.length },
      { METRICA: 'STOCK — TOTAL FILAS', VALOR: stock.length }
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Dashboard');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(devices, LDU_DEVICE_EXPORT_FIELDS)), 'General');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(inventario, LDU_DEVICE_EXPORT_FIELDS)), 'Inventario LDU');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(incidents, INCIDENT_EXPORT_FIELDS_)), 'Incidencias');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(modelA, LDU_DEVICE_EXPORT_FIELDS)), 'Modelos Ant. A');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(modelB, LDU_DEVICE_EXPORT_FIELDS)), 'Modelos Ant. B');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(noVivo, LDU_DEVICE_EXPORT_FIELDS)), 'IMEI NO VIVO');
    XLSX.writeFile(wb, 'LDU_Reporte_General.xlsx');
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
    var stock = state.stock || [], devices = state.devices || [];
    var reconciled = window.lduReconcile ? window.lduReconcile(devices, stock) : { deviceBy: {} };
    var mapped = stock.map(function (r) {
      var d = reconciled.deviceBy[I(r.imei)] || {};
      return Object.assign({}, r, {
        inventario: d.imei ? 'EN INVENTARIO' : 'NO EN INVENTARIO',
        estado: d.imei ? (d.estado || d.estado_inventario) : (r.estado_inventario || r.estado)
      });
    });
    var byGroup = function (g) { return mapped.filter(function (r) { return stockGroup_(r) === g; }); };
    var noVivo = await noVivoDevices();
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(byGroup('INVENTARIO'), LDU_STOCK_EXPORT_FIELDS)), 'Stock Inventario');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(byGroup('A'), LDU_STOCK_EXPORT_FIELDS)), 'Stock Modelos A');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(byGroup('B'), LDU_STOCK_EXPORT_FIELDS)), 'Stock Modelos B');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildSheetRows(noVivo, LDU_DEVICE_EXPORT_FIELDS)), 'IMEI NO VIVO');
    XLSX.writeFile(wb, 'LDU_Stock_Reporte_General.xlsx');
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
