/* v85 - contrato único de grupos, faltantes, valores y estado Stock. */
(function () {
  'use strict';
  function id(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function n(v) { var s = String(v == null ? '' : v).trim().replace(/[^0-9,.-]/g, ''); if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.indexOf(',') >= 0) s = s.replace(',', '.'); var x = Number(s); return Number.isFinite(x) ? x : 0; }
  function m(v) { return 'S/ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n(v)); }
  function u(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function uniq(rows) { var seen = new Set(); return (rows || []).filter(function (r) { var k = id(r.imei || r.imei_original); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; }); }
  function devices() { return uniq(state.devices && state.devices.length ? state.devices : state.__systemRows || []); }
  function stockRows() { return uniq(state.stock || []); }
  function groupRows(group) { return devices().filter(function (r) { return groupFor(r.modelo) === group; }); }
  function stockFor(rows) { var ids = new Set((rows || []).map(function (r) { return id(r.imei || r.imei_original); }).filter(Boolean)); return stockRows().filter(function (r) { return ids.has(id(r.imei)); }); }
  function groupTotals(rows) {
    rows = uniq(rows || []); var stock = stockFor(rows), byId = new Map(stock.map(function (r) { return [id(r.imei), r]; }));
    var count = function (s) { return rows.filter(function (r) { return u(r.estado) === u(s); }).length; };
    var value = rows.reduce(function (sum, r) { var s = byId.get(id(r.imei || r.imei_original)); return sum + n(r.monto !== '' && r.monto != null ? r.monto : (r.valor !== '' && r.valor != null ? r.valor : s && (s.monto || s.valor))); }, 0);
    var missing = rows.filter(function (r) { return !byId.has(id(r.imei || r.imei_original)); }).length;
    return { stock: rows.length, enInv: stock.length, act: count('Activo'), alm: count('Almacén'), dan: count('Dañado'), rep: count('En Reparación'), per: count('Perdido'), baja: count('Baja'), pdev: count('Pendiente Devolución'), dev: count('Devuelto'), falt: missing, noInv: 0, noVivo: missing, valor: value };
  }
  window.totals = function (rows) { if (rows === state.devices || !rows || !rows.length) { var all = stockRows(); var t = groupTotals(devices()); t.stock = all.length; t.enInv = all.filter(function (r) { return u(r.en_inventario) === 'SI'; }).length; t.noInv = all.filter(function (r) { return u(r.en_inventario) === 'NO'; }).length; t.noVivo = all.filter(function (r) { return u(r.en_inventario) === 'NO VIVO'; }).length; return t; } return groupTotals(rows); };
  window.formatLduMoney = m;

  window.stateSection = stateSection = function (title, rows, group) { var t = groupTotals(rows); return '<section class="section dashboard-module ' + String(group).toLowerCase() + '"><div class="section-head"><h2>' + safe(title) + '</h2><div><button class="btn secondary" onclick="navigate(\'' + (group === 'A' ? 'modelA' : group === 'B' ? 'modelB' : 'inventory') + '\')">VER MÓDULO →</button></div></div><div class="cards compact module-state-cards">' + card('📊 TOTAL', rows.length) + card('✅ ACTIVOS', t.act) + card('🏬 ALMACÉN', t.alm) + card('💥 DAÑADOS', t.dan) + card('🔧 REPARACIÓN', t.rep) + card('🔎 PERDIDOS', t.per) + card('⛔ BAJA', t.baja) + card('📦 PENDIENTE DEVOLUCIÓN', t.pdev) + card('↩️ DEVUELTO', t.dev) + card('⚠️ FALTANTE', t.falt) + card('💰 VALOR TOTAL', m(t.valor)) + '</div></section>'; };
  window.stockSummary = stockSummary = function () { var groups = [['✅ INVENTARIO LDU', 'INVENTARIO'], ['🟦 MODELOS ANTIGUOS A', 'A'], ['🟧 MODELOS ANTIGUOS B', 'B']]; return '<section class="section stock-summary"><div class="section-head"><h2>📦 RESUMEN DE STOCK POR MODELO</h2></div>' + groups.map(function (pair) { var rows = groupRows(pair[1]), models = Array.from(new Set(rows.map(function (r) { return r.modelo; }).filter(Boolean))); return '<div class="stock-group"><div class="stock-group-head"><h3>' + pair[0] + '</h3></div>' + table(models.map(function (model) { var modelRows = rows.filter(function (r) { return u(r.modelo) === u(model); }), t = groupTotals(modelRows); return { modelo: model, stock: modelRows.length, en_inventario: t.enInv, faltante: t.falt, activos: t.act, almacen: t.alm, danados: t.dan, reparacion: t.rep, perdidos: t.per, baja: t.baja, devueltos: t.dev, monto: t.valor }; }), ['modelo','stock','en_inventario','faltante','activos','almacen','danados','reparacion','perdidos','baja','devueltos','monto']) + '</div>'; }).join('') + '</section>'; };

  var oldStock = window.renderStock;
  window.renderStock = renderStock = async function () { return oldStock(); };
  var oldDevices = window.renderDevices;
  if (typeof oldDevices === 'function') window.renderDevices = renderDevices = function (group) { return Promise.resolve(oldDevices(group)).then(function () { var t = groupTotals(state.rows || []); document.querySelectorAll('.dashboard-overview .metric, .module-state-cards .metric').forEach(function (node) { var label = (node.querySelector('span') || {}).textContent || ''; if (/VALOR TOTAL|MONTO TOTAL/i.test(label)) { var value = node.querySelector('strong'); if (value) value.textContent = m(t.valor); } }); }); };
  var style = document.createElement('style'); style.textContent = '.stock-screen .stock-cards,.dashboard-module .module-state-cards{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));align-items:stretch}.stock-screen .stock-cards .metric,.dashboard-module .module-state-cards .metric{min-height:82px;display:flex;flex-direction:column;justify-content:center}.dashboard-module .module-state-cards .metric:last-child{grid-column:span 2}@media(max-width:700px){.dashboard-module .module-state-cards .metric:last-child{grid-column:span 1}}'; document.head.appendChild(style);
}());
