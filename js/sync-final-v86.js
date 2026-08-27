/* v86 - resumen único: las tarjetas leen exactamente estas mismas filas. */
(function () {
  function U(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(); }
  window.stockSummary = stockSummary = function () {
    var groups = [['✅ INVENTARIO LDU', 'INVENTARIO'], ['🟦 MODELOS ANTIGUOS A', 'A'], ['🟧 MODELOS ANTIGUOS B', 'B']];
    return '<section class="section stock-summary"><div class="section-head"><h2>📦 RESUMEN DE STOCK POR MODELO</h2></div>' + groups.map(function (pair) {
      var rows = (state.devices || []).filter(function (r) { return groupFor(r.modelo) === pair[1]; });
      var models = Array.from(new Set(rows.map(function (r) { return r.modelo; }).filter(Boolean)));
      var data = models.map(function (model) { var modelRows = rows.filter(function (r) { return U(r.modelo) === U(model); }), t = totals(modelRows); return { modelo: model, stock: modelRows.length, en_inventario: t.enInv, faltante: t.falt, activos: t.act, almacen: t.alm, danados: t.dan, reparacion: t.rep, perdidos: t.per, baja: t.baja, pendiente_devolucion: t.pdev, devueltos: t.dev, monto: t.valor }; });
      return '<div class="stock-group"><div class="stock-group-head"><h3>' + pair[0] + '</h3></div>' + table(data, ['modelo','stock','en_inventario','faltante','activos','almacen','danados','reparacion','perdidos','baja','pendiente_devolucion','devueltos','monto']) + '</div>';
    }).join('') + '</section>';
  };
}());
