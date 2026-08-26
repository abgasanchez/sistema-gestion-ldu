/* v87 - Resumen de Stock por Modelo basado en Sistema + Stock. */
(function () {
  'use strict';
  function U(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function I(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function N(v) { if (typeof v === 'number') return Number.isFinite(v) ? v : 0; var s = String(v == null ? '' : v).replace(/[^0-9,.-]/g, ''); if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.indexOf(',') >= 0) s = s.replace(',', '.'); var n = Number(s); return Number.isFinite(n) ? n : 0; }
  function M(v) { return 'S/ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(N(v)); }
  function unique(rows) { var seen = new Set(); return (rows || []).filter(function (r) { var k = I(r.imei || r.imei_original); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; }); }
  function modelSummary(group, model) {
    var system = unique(state.devices || []).filter(function (r) { return groupFor(r.modelo) === group && U(r.modelo) === U(model); });
    var stock = unique(state.stock || []).filter(function (r) { return groupFor(r.modelo) === group && U(r.modelo) === U(model); });
    var stockIds = new Set(stock.map(function (r) { return I(r.imei); }).filter(Boolean));
    var found = system.filter(function (r) { return stockIds.has(I(r.imei)); });
    var t = system.length ? totals(system) : { act: 0, alm: 0, dan: 0, rep: 0, per: 0, baja: 0, pdev: 0, dev: 0, valor: 0 };
    return { modelo: model, stock: system.length || stock.length, en_inventario: found.length, faltante: system.filter(function (r) { return !stockIds.has(I(r.imei)); }).length, activos: t.act, almacen: t.alm, danados: t.dan, reparacion: t.rep, perdidos: t.per, baja: t.baja, pendiente_devolucion: t.pdev, devueltos: t.dev, monto: t.valor };
  }
  window.stockSummary = stockSummary = function () {
    var groups = [['✅ INVENTARIO LDU', 'INVENTARIO'], ['🟦 MODELOS ANTIGUOS A', 'A'], ['🟧 MODELOS ANTIGUOS B', 'B']];
    return '<section class="section stock-summary"><div class="section-head"><h2>📦 RESUMEN DE STOCK POR MODELO</h2><button class="btn secondary" onclick="renderDashboard()">🔄 ACTUALIZAR</button></div>' + groups.map(function (pair) {
      var models = Array.from(new Set([].concat(state.devices || [], state.stock || []).filter(function (r) { return groupFor(r.modelo) === pair[1]; }).map(function (r) { return r.modelo; }).filter(Boolean))).sort();
      var rows = models.map(function (model) { return modelSummary(pair[1], model); });
      return '<div class="stock-group"><div class="stock-group-head"><h3>' + pair[0] + '</h3></div>' + table(rows, ['modelo','stock','en_inventario','faltante','activos','almacen','danados','reparacion','perdidos','baja','pendiente_devolucion','devueltos','monto']) + '</div>';
    }).join('') + '</section>';
  };
}());
