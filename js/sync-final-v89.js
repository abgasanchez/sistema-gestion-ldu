/* v89: sincronización final de grupos, montos y sesión. */
(function () {
  'use strict';
  var GROUP_A = ['V50', 'V50 LITE', 'Y04', 'Y19S', 'Y29S', 'Y39'];
  var GROUP_B = ['V40 SE', 'V30 SE', 'V25', 'V25 E', 'Y36', 'Y28S', 'Y03', 'Y17S', 'Y18', 'Y53S', 'Y55', 'Y27', 'V21', 'Y16', 'Y17', 'Y35', 'Y22S'];
  function n(v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function modelGroup(model) { var key = n(model); if (GROUP_A.indexOf(key) >= 0) return 'A'; if (GROUP_B.indexOf(key) >= 0) return 'B'; return 'INVENTARIO'; }
  function id(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function amount(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var s = String(v == null ? '' : v).replace(/[^0-9,.-]/g, ''); if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.indexOf(',') >= 0) s = s.replace(',', '.'); var x = Number(s); return isFinite(x) ? x : 0; }
  function unique(rows) { var seen = {}; return (rows || []).filter(function (r) { var k = id(r.imei || r.imei_original); if (!k) return true; if (seen[k]) return false; seen[k] = true; return true; }); }
  function money(v) { return 'S/ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount(v)); }
  function currentRows(g, model) { return unique(state.devices || []).filter(function (r) { return modelGroup(r.modelo) === g && (!model || n(r.modelo) === n(model)); }); }
  function stockRows(g, model) { return unique(state.stock || []).filter(function (r) { return modelGroup(r.modelo) === g && (!model || n(r.modelo) === n(model)); }); }
  function summary(g) {
    var models = Array.from(new Set([].concat(state.stock || [], state.devices || []).filter(function (r) { return modelGroup(r.modelo) === g && r.modelo; }).map(function (r) { return r.modelo; }))).sort();
    var rows = models.map(function (model) {
      var st = stockRows(g, model), inv = currentRows(g, model), by = {}; inv.forEach(function (r) { by[id(r.imei)] = r; });
      var matched = st.map(function (r) { return { stock: r, system: by[id(r.imei)] }; }).filter(function (x) { return x.system; });
      var stateOf = function (x) { return n(x.system && (x.system.estado || x.system.estado_inventario) || x.stock.estado || x.stock.estado_inventario); };
      var count = function (s) { return matched.filter(function (x) { return stateOf(x) === n(s); }).length; };
      var value = st.reduce(function (sum, x) { var d = by[id(x.imei)] || {}; return sum + amount(d.monto !== '' && d.monto != null ? d.monto : (d.valor !== '' && d.valor != null ? d.valor : (x.monto !== '' && x.monto != null ? x.monto : x.valor))); }, 0);
      return { modelo: model, stock: st.length, activos: count('Activo'), almacen: count('Almacén'), danados: count('Dañado'), reparacion: count('En Reparación'), perdidos: count('Perdido'), baja: count('Baja'), pendiente_devolucion: count('Pendiente Devolución'), devueltos: count('Devuelto'), monto: value, faltante: Math.max(0, st.length - matched.length) };
    });
    var total = rows.reduce(function (a, r) { Object.keys(r).forEach(function (k) { if (k !== 'modelo') a[k] = (a[k] || 0) + (k === 'monto' ? amount(r[k]) : Number(r[k] || 0)); }); return a; }, { modelo: 'TOTAL', stock: 0, activos: 0, almacen: 0, danados: 0, reparacion: 0, perdidos: 0, baja: 0, pendiente_devolucion: 0, devueltos: 0, monto: 0, faltante: 0 });
    return rows.concat(total);
  }
  window.stockSummary = window.stockSummary = function () { var groups = [['✅ INVENTARIO LDU', 'INVENTARIO'], ['🟦 MODELOS ANTIGUOS A', 'A'], ['🟧 MODELOS ANTIGUOS B', 'B']], fields = ['modelo', 'stock', 'activos', 'almacen', 'danados', 'reparacion', 'perdidos', 'baja', 'pendiente_devolucion', 'devueltos', 'monto', 'faltante']; return '<section class="section stock-summary"><div class="section-head"><h2>📦 RESUMEN DE STOCK POR MODELO</h2><button class="btn secondary" onclick="renderDashboard()">🔄 ACTUALIZAR</button></div>' + groups.map(function (g) { return '<div class="stock-group"><div class="stock-group-head"><h3>' + g[0] + '</h3></div>' + table(summary(g[1]), fields) + '</div>'; }).join('') + '</section>'; };
  function profile() { var raw = sessionStorage.getItem('ldu-session') || localStorage.getItem('lduUser') || localStorage.getItem('currentUser') || '{}', user = {}; try { user = JSON.parse(raw); } catch (_) {} user = user.data || user; var name = user.name || user.nombre || user.username || user.usuario || 'USUARIO'; var role = user.role || user.rol || 'USUARIO'; var footer = document.querySelector('.sidebar-footer'); if (!footer) return; footer.innerHTML = '<div class="sidebar-profile"><b>👤 ' + safe(String(name).toUpperCase()) + '</b><small>' + safe(String(role).toUpperCase()) + '</small><button class="btn secondary sidebar-logout" id="ldu-logout">↪ CERRAR SESIÓN</button></div><div>VERSIÓN MODULAR 1.0</div>'; document.querySelector('#ldu-logout').onclick = async function () { try { if (user.token) await api('logout', { token: user.token }); } catch (_) {} sessionStorage.removeItem('ldu-session'); sessionStorage.removeItem('ldu-authenticated'); localStorage.removeItem('lduUser'); localStorage.removeItem('currentUser'); location.reload(); }; }
  document.addEventListener('DOMContentLoaded', profile); setTimeout(profile, 300); setTimeout(profile, 1200);
  var style = document.createElement('style'); style.textContent = '.total-row td,.stock-summary tbody tr:last-child td{background:#0b2357!important;color:#fff!important;font-weight:800}.module-filters,.toolbar,.dashboard-toolbar,.map-filters{background:#0b2357;border-radius:8px;padding:8px}.module-filters .input,.module-filters .select,.toolbar .input,.toolbar .select{background:#fff}.sidebar-logout{display:block;width:100%;margin-top:7px;padding:4px 8px;font-size:11px}.sidebar-profile{border-top:1px solid #ffffff33;padding:12px 0 8px;margin-bottom:6px}.sidebar-profile b,.sidebar-profile small{display:block}.sidebar-profile small{color:#c7d2fe;margin-top:3px}'; document.head.appendChild(style);
}());
(function () {
  /* La etiqueta IMEI NO VIVO solo se aplica a IMEI del sistema ausentes en Stock. */
  var baseApi = window.api;
  function key(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function reconcile() {
    var stock = {}, devices = {};
    (state.stock || []).forEach(function (r) { var k = key(r.imei); if (k) stock[k] = true; });
    (state.devices || []).forEach(function (r) { var k = key(r.imei); if (k) devices[k] = true; });
    state.devices = (state.devices || []).map(function (r) { var k = key(r.imei); return Object.assign({}, r, { en_inventario: k && stock[k] ? 'SI' : 'IMEI NO VIVO' }); });
    state.stock = (state.stock || []).map(function (r) { var k = key(r.imei); return Object.assign({}, r, { en_inventario: k && devices[k] ? 'EN INVENTARIO' : 'NO EN INVENTARIO', __noStock: !(k && devices[k]) }); });
  }
  window.api = async function (action, payload) {
    var result = await baseApi(action, payload);
    if (result && result.status === 'ok' && Array.isArray(result.data) && (action === 'listDevices' || action === 'listStock')) {
      result.data = result.data.map(function (r) { return Object.assign({}, r, { en_inventario: r.en_inventario === 'NO VIVO' ? 'IMEI NO VIVO' : r.en_inventario }); });
      if (action === 'listDevices') state.devices = result.data; else state.stock = result.data;
      reconcile(); result.data = action === 'listDevices' ? state.devices : state.stock;
    }
    return result;
  };
  var labels = function () { document.querySelectorAll('option').forEach(function (o) { if (o.value === 'NO VIVO' || o.textContent.trim() === 'NO VIVO') { o.value = 'IMEI NO VIVO'; o.textContent = 'IMEI NO VIVO'; } }); };
  document.addEventListener('DOMContentLoaded', labels); setTimeout(labels, 500); setTimeout(labels, 1500); if (window.MutationObserver) new MutationObserver(labels).observe(document.body, { childList: true, subtree: true });
}());
(function () {
  /* Un lote grande reduce los viajes a Apps Script; el backend usa IMEI como clave idempotente. */
  var oldPreview = window.previewImport;
  window.previewImport = async function (file, module, card) {
    if (!window.XLSX || !file) return oldPreview(file, module, card);
    var raw = XLSX.utils.sheet_to_json(XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false }).Sheets[XLSX.read(await file.arrayBuffer(), { type: 'array' }).SheetNames[0]], { defval: '' });
    var rows = (window.canonicalizeImportRows ? window.canonicalizeImportRows(raw, module) : raw);
    if (!rows.length) { alert('El archivo no contiene registros.'); return; }
    var drawer = document.createElement('div'); drawer.className = 'drawer';
    drawer.innerHTML = '<aside class="drawer-card import-preview-card"><div class="section-head"><h2>📋 VISTA PREVIA — ' + safe(file.name) + '</h2><button class="btn secondary" data-close>✕</button></div><p>Registros detectados: <strong>' + rows.length + '</strong></p>' + table(rows.slice(0, 10), Object.keys(rows[0])) + '<progress max="100" value="0" data-progress></progress><div data-status>LISTO PARA IMPORTAR.</div><div data-result></div><div class="form-actions"><button class="btn secondary" data-cancel>CANCELAR</button><button class="btn" data-confirm>📥 IMPORTAR</button></div></aside>';
    document.body.appendChild(drawer); var close = function () { drawer.remove(); }; drawer.querySelector('[data-close]').onclick = close; drawer.querySelector('[data-cancel]').onclick = close;
    drawer.querySelector('[data-confirm]').onclick = async function () { var b = this, p = drawer.querySelector('[data-progress]'), s = drawer.querySelector('[data-status]'), out = drawer.querySelector('[data-result]'); b.disabled = true; s.textContent = 'PROCESANDO ' + rows.length + ' REGISTROS...'; try { var r = await api('importRows', { module: module, rows: rows, userId: 'importacion', batchId: 'imp89-' + Date.now() }), d = r.data || {}; p.value = 100; s.textContent = '✅ FINALIZADO'; out.innerHTML = '<strong>RESUMEN:</strong> Procesados: ' + rows.length + ' · Nuevos: ' + (d.imported || d.inserted || 0) + ' · Actualizados: ' + (d.updated || 0) + ' · Rechazados: ' + ((d.rejectedRows || []).length); if (r.status === 'ok' && !(d.rejectedRows || []).length) setTimeout(function () { close(); navigate(module === 1 ? 'incidents' : module >= 2 ? 'stock' : 'inventory'); }, 700); } catch (e) { s.textContent = '❌ ERROR'; out.textContent = e.message; } finally { b.disabled = false; } };
  };
}());
