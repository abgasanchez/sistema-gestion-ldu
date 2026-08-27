/* v93 - respuesta rápida y normalización de Incidencias. */
(function () {
  'use strict';
  var normalizeIncident = function (r) { r = Object.assign({}, r || {}); r.imei_original = r.imei_original || r.imeiOriginal || r.imei || r.imeioriginal || ''; r.nombre = r.nombre || r.nombre_completo || r.responsable || ''; r.responsable = r.responsable || r.nombre; r.valor = r.valor !== undefined && r.valor !== '' ? r.valor : (r.monto !== undefined ? r.monto : ''); r.estado_proceso = r.estado_proceso || r.estadoProceso || r.estadoproceso || ''; return r; };
  var baseApi = typeof api === 'function' ? api : window.api;
  if (baseApi) api = window.api = function (action, payload) {
    var request = Promise.resolve().then(function () { return baseApi(action, payload); });
    if (action !== 'listDevices' && action !== 'listStock' && action !== 'listIncidents') return request;
    var timer = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('Apps Script no respondió en 12 segundos. Verifica que el despliegue esté configurado como “Cualquier usuario”.')); }, 12000); });
    return Promise.race([request, timer]).then(function (result) { if (action === 'listIncidents' && result && Array.isArray(result.data)) result.data = result.data.map(normalizeIncident); return result; });
  };
  var repairTotals = function () { document.querySelectorAll('.stock-summary table').forEach(function (table) { var foot = table.querySelector('tfoot[data-v37-total]'), row = foot && foot.querySelector('tr'); if (!row) return; var clone = row.cloneNode(true); clone.className = 'total-row'; table.querySelector('tbody')?.appendChild(clone); foot.remove(); }); };
  var install = function () { var app = document.querySelector('#app'); if (!app || app.dataset.v93Totals) return; app.dataset.v93Totals = '1'; new MutationObserver(function () { setTimeout(repairTotals, 0); }).observe(app, { childList: true, subtree: true }); repairTotals(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
}());
