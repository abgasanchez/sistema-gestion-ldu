/* v78 - cargado por IMEI y faltante real del Stock. */
(function () {
  function k(v) { return String(v == null ? '' : v).replace(/[\u00a0\s]/g, '').replace(/\.0+$/, '').replace(/\D/g, ''); }
  function n(v) { var s = String(v == null ? '' : v).replace(/[^0-9,.-]/g, ''); if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); var x = Number(s); return isFinite(x) ? x : 0; }
  function stateOf(r, by) { var x = r && r.estado; if (!x || String(x).trim().toLowerCase() === 'sin estado') x = (by[k(r && r.imei)] || {}).estado || ''; return x; }
  window.stockSummary = function () {
    var groups = [['✅ Inventario LDU', 'INVENTARIO'], ['🟦 Modelos Antiguos A', 'A'], ['🟧 Modelos Antiguos B', 'B']], stock = state.stock || [], devices = state.devices || [], by = {};
    devices.forEach(function (d) { by[k(d.imei)] = d; });
    var html = '<section class="section stock-summary"><div class="section-head"><h2>📦 Resumen de Stock por Modelo</h2><button class="btn secondary" onclick="renderDashboard()">🔄 Actualizar</button></div>';
    groups.forEach(function (g) {
      var rows = stock.filter(function (r) { return groupFor(r.modelo) === g[1]; }), models = [];
      rows.forEach(function (r) { if (r.modelo && models.indexOf(r.modelo) < 0) models.push(r.modelo); });
      var out = models.map(function (model) { var rs = rows.filter(function (r) { return norm(r.modelo) === norm(model); }), loaded = rs.filter(function (r) { return !!by[k(r.imei)]; }); function count(s) { return loaded.filter(function (r) { return norm(stateOf(r, by)) === norm(s); }).length; } return { modelo: model, stock: rs.length, en_inventario: loaded.length, activos: count('Activo'), almacen: count('Almacén'), danados: count('Dañado'), en_reparacion: count('En Reparación'), perdidos: count('Perdido'), baja: count('Baja'), pendiente_devolucion: count('Pendiente Devolución'), devueltos: count('Devuelto'), monto: rs.reduce(function (a, r) { return a + n(r.monto); }, 0).toFixed(2), faltante: Math.max(0, rs.length - loaded.length) }; });
      html += '<div class="stock-group"><div class="stock-group-head"><h3>' + g[0] + '</h3></div>' + table(out, ['modelo','stock','en_inventario','activos','almacen','danados','en_reparacion','perdidos','baja','pendiente_devolucion','devueltos','monto','faltante']) + '</div>';
    });
    return html + '</section>';
  };
  var oldStock = window.renderStock;
  if (typeof oldStock === 'function') window.renderStock = async function () { await oldStock(); try { var ds = state.devices && state.devices.length ? state.devices : ((await api('listDevices')).data || []), by = {}; ds.forEach(function (d) { by[k(d.imei)] = d; }); document.querySelectorAll('[data-stock-imei]').forEach(function (b) { var tr = b.closest('tr'), c = tr && tr.cells[7], d = by[k(b.dataset.stockImei)]; if (c && d && /sin estado/i.test(c.textContent)) c.innerHTML = badge(d.estado || 'Sin estado'); }); } catch (e) { console.warn('Sincronización Stock v78:', e.message); } };
  var st = document.createElement('style'); st.textContent = '.stock-summary td:last-child,.stock-summary th:last-child{font-weight:700!important}'; document.head.appendChild(st);
}());
