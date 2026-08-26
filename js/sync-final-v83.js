/* v83 - fuente única para métricas, Stock e Historial IMEI. */
(function () {
  'use strict';

  function key(value) { return String(value == null ? '' : value).replace(/\D/g, ''); }
  function upper(value) { return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    var text = String(value == null ? '' : value).trim().replace(/[^0-9,.-]/g, '');
    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else if (text.indexOf(',') >= 0) text = text.replace(',', '.');
    var parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function money(value) { return 'S/ ' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value)); }
  function rowState(row) { return upper(row && (row.estado || row.estado_inventario || row.estado_proceso)); }
  function unique(rows) {
    var seen = new Set();
    return (rows || []).filter(function (row) { var id = key(row.imei || row.imei_original); if (!id) return true; if (seen.has(id)) return false; seen.add(id); return true; });
  }
  function scopedStock(rows) {
    var stock = unique(state.stock || []), ids = new Set((rows || []).map(function (r) { return key(r.imei || r.imei_original); }).filter(Boolean));
    return rows === state.devices ? stock : stock.filter(function (r) { return ids.has(key(r.imei)); });
  }
  function totalsFixed(rows) {
    rows = unique(rows || []);
    var stock = scopedStock(rows), deviceIds = new Set(rows.map(function (r) { return key(r.imei || r.imei_original); }).filter(Boolean));
    var count = function (stateName) { return rows.filter(function (r) { return rowState(r) === upper(stateName); }).length; };
    var noInventory = stock.filter(function (r) { return upper(r.en_inventario) === 'NO'; }).length;
    var globalNoVivo = stock.filter(function (r) { return upper(r.en_inventario) === 'NO VIVO'; }).length;
    var stockById = new Map(stock.map(function (r) { return [key(r.imei), r]; }));
    var missing = rows.filter(function (r) { return !stockById.has(key(r.imei || r.imei_original)); }).length;
    var inInventory = stock.filter(function (r) { return upper(r.en_inventario) === 'SI'; }).length;
    var scopedNoVivo = rows.length ? missing : globalNoVivo;
    return { stock: rows === state.devices ? stock.length : rows.length, enInv: inInventory, act: count('Activo'), alm: count('Almacén'), dan: count('Dañado'), rep: count('En Reparación'), per: count('Perdido'), baja: count('Baja'), pdev: count('Pendiente Devolución'), dev: count('Devuelto'), falt: missing, noInv: noInventory, noVivo: scopedNoVivo, valor: rows.reduce(function (sum, r) { return sum + number(r.monto !== '' && r.monto != null ? r.monto : r.valor); }, 0) };
  }
  window.LDU_AMOUNT = number;
  window.formatLduMoney = money;
  window.totals = totalsFixed;

  function stockBadge(value) {
    var stateName = upper(value), cls = stateName === 'EN INVENTARIO' || stateName === 'SI' ? 'green' : stateName === 'NO EN INVENTARIO' || stateName === 'NO' ? 'red' : stateName === 'IMEI NO VIVO' || stateName === 'NO VIVO' ? 'purple' : 'gray';
    return '<span class="badge ' + cls + '">' + safe(value || 'Sin estado') + '</span>';
  }
  function renderStockFixed() {
    loading('Cargando Stock...');
    api('listStock').then(function (response) {
      if (!response || response.status === 'error') throw Error(response && response.message || 'No se pudo cargar Stock.');
      state.stock = unique(response.data || []);
      var rows = state.stock;
      document.querySelector('#app').innerHTML = '<section class="section stock-screen"><div class="section-head"><h2>📦 Stock</h2><div><button class="btn secondary" id="stock-refresh">🔄 Actualizar</button><button class="btn secondary" id="stock-export">📄 Exportar</button></div></div><div class="stock-tabs"><button class="btn active">📦 Stock</button><button class="btn secondary">🟦 Stock Mod. A</button><button class="btn secondary">🟧 Stock Mod. B</button></div><div class="cards stock-cards"><div class="metric"><strong>' + rows.length + '</strong><span>📦 TOTAL STOCK</span></div><div class="metric"><strong>' + rows.filter(function (r) { return upper(r.en_inventario) === 'SI'; }).length + '</strong><span>✅ EN INVENTARIO</span></div><div class="metric"><strong>' + rows.filter(function (r) { return upper(r.en_inventario) === 'NO'; }).length + '</strong><span>⚠️ NO EN INVENTARIO</span></div><div class="metric"><strong>' + rows.filter(function (r) { return upper(r.en_inventario) === 'NO VIVO'; }).length + '</strong><span>📵 IMEI NO VIVO</span></div><div class="metric"><strong>' + money(rows.reduce(function (sum, r) { return sum + number(r.monto !== '' && r.monto != null ? r.monto : r.valor); }, 0)) + '</strong><span>💰 VALOR TOTAL</span></div></div><div class="section-body"><div class="toolbar"><input class="input" id="stock-q" placeholder="Buscar IMEI, cuenta, marca, modelo..."><select class="select" id="stock-cuenta"><option value="">Cuenta</option></select><select class="select" id="stock-marca"><option value="">Marca</option></select><select class="select" id="stock-modelo"><option value="">Modelo</option></select><select class="select" id="stock-inv"><option value="">En Inventario</option><option>SI</option><option>NO</option><option>NO VIVO</option></select><select class="select" id="stock-state"><option value="">Estado Inventario</option></select></div></div><div class="stock-layout"><section class="section stock-panel"><div class="table-wrap module-table"><table><thead><tr><th>CUENTA</th><th>IMEI</th><th>MARCA</th><th>MODELO</th><th>VALOR TOTAL</th><th>FECHA DE INGRESO</th><th>INVENTARIO</th><th>ESTADO</th><th>GUÍA</th><th>OBSERVACIONES</th><th>ACC.</th></tr></thead><tbody id="stock-body"></tbody></table></div></section><section class="section stock-panel"><div class="section-head"><h2>📋 Panel del Equipo</h2></div><div id="stock-detail" class="empty">Selecciona un IMEI para ver sus movimientos.</div></section></div></section>';
      [['stock-cuenta','cuenta'],['stock-marca','marca'],['stock-modelo','modelo']].forEach(function (pair) { Array.from(new Set(rows.map(function (r) { return r[pair[1]]; }).filter(Boolean))).sort().forEach(function (value) { document.querySelector('#' + pair[0]).insertAdjacentHTML('beforeend', '<option>' + safe(value) + '</option>'); }); });
      LDU_STATES.forEach(function (value) { document.querySelector('#stock-state').insertAdjacentHTML('beforeend', '<option>' + safe(value) + '</option>'); });
      function draw() {
        var query = upper(document.querySelector('#stock-q').value), inventory = upper(document.querySelector('#stock-inv').value), account = upper(document.querySelector('#stock-cuenta').value), brand = upper(document.querySelector('#stock-marca').value), model = upper(document.querySelector('#stock-modelo').value), status = upper(document.querySelector('#stock-state').value);
        var out = rows.filter(function (r) { return (!query || Object.keys(r).some(function (k) { return upper(r[k]).indexOf(query) >= 0; })) && (!inventory || upper(r.en_inventario) === inventory) && (!account || upper(r.cuenta) === account) && (!brand || upper(r.marca) === brand) && (!model || upper(r.modelo) === model) && (!status || upper(r.estado_inventario || r.estado) === status); });
        window.__stockFiltered = out;
        document.querySelector('#stock-body').innerHTML = out.map(function (r) { var inv = upper(r.en_inventario), status = inv === 'SI' ? 'EN INVENTARIO' : inv === 'NO' ? 'NO EN INVENTARIO' : inv === 'NO VIVO' ? 'IMEI NO VIVO' : r.estado_inventario; return '<tr><td>' + safe(r.cuenta) + '</td><td><button class="link-button" data-stock-imei="' + safe(r.imei) + '">' + safe(r.imei) + '</button></td><td>' + safe(r.marca) + '</td><td>' + safe(r.modelo) + '</td><td>' + money(r.monto !== '' && r.monto != null ? r.monto : r.valor) + '</td><td>' + safe(displayImportValue(r.fecha_ingreso, 'fecha_ingreso')) + '</td><td>' + stockBadge(status) + '</td><td>' + badge(r.estado_inventario || r.estado) + '</td><td>' + safe(r.guia) + '</td><td>' + safe(r.observaciones) + '</td><td class="row-actions"><button data-stock-action="view" data-id="' + safe(r.imei) + '">👁️</button><button data-stock-action="history" data-id="' + safe(r.imei) + '">📜</button><button data-stock-action="edit" data-id="' + safe(r.imei) + '">✎️</button><button data-stock-action="delete" data-id="' + safe(r.imei) + '">✕</button></td></tr>'; }).join('') || '<tr><td colspan="11" class="empty">Sin resultados</td></tr>';
        document.querySelectorAll('[data-stock-imei]').forEach(function (button) { button.onclick = function () { var r = rows.find(function (x) { return String(x.imei) === String(button.dataset.stockImei); }); document.querySelector('#stock-detail').innerHTML = Object.keys(r || {}).map(function (k) { return '<div class="detail-row"><b>' + safe(k) + '</b>' + safe(displayImportValue(r[k], k)) + '</div>'; }).join(''); }; });
        document.querySelectorAll('[data-stock-action]').forEach(function (button) { button.onclick = function () { var row = rows.find(function (x) { return String(x.imei) === String(button.dataset.id); }); if (button.dataset.stockAction === 'history') { state.historyImei = button.dataset.id; navigate('history'); } else if (button.dataset.stockAction === 'view') showDetail(row); else if (button.dataset.stockAction === 'edit' && typeof openDeviceForm === 'function') openDeviceForm(row); else if (button.dataset.stockAction === 'delete') alert('La edición y eliminación de Stock se gestionan mediante una nueva importación para conservar el Kardex.'); }; });
      }
      ['stock-q','stock-cuenta','stock-marca','stock-modelo','stock-inv','stock-state'].forEach(function (id) { document.querySelector('#' + id).oninput = draw; document.querySelector('#' + id).onchange = draw; }); document.querySelector('#stock-refresh').onclick = renderStockFixed; document.querySelector('#stock-export').onclick = function () { exportRows(window.__stockFiltered || rows, 'stock'); }; draw();
    }).catch(function (error) { errorView('No se pudo cargar Stock', error, 'renderStock'); });
  }
  window.renderStock = renderStock = renderStockFixed;
  var style = document.createElement('style');
  style.textContent = 'h1,h2,h3,.section-head,.metric span,.nav-group,.nav-item,.btn,.select,.input,th{text-transform:uppercase}.stock-cards{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:12px}.stock-cards .metric{min-height:84px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}.stock-cards .metric:nth-child(2){border-top:4px solid #16a34a}.stock-cards .metric:nth-child(3){border-top:4px solid #dc2626}.stock-cards .metric:nth-child(4){border-top:4px solid #7e22ce}.stock-cards .metric:nth-child(5){border-top:4px solid #d97706}@media(max-width:900px){.stock-cards{grid-template-columns:repeat(2,minmax(150px,1fr))}}';
  document.head.appendChild(style);

  var oldHistory = window.renderHistory;
  window.renderHistory = renderHistory = async function () {
    loading('Cargando Historial IMEI...');
    try {
      var response = await api('listHistory'), entries = (response && response.data) || [];
      if (response && response.status === 'error') throw Error(response.message);
      var rows = entries.map(function (entry) { var before = {}, after = {}; try { before = typeof entry.before_json === 'string' ? JSON.parse(entry.before_json || '{}') : (entry.before_json || {}); } catch (_) {} try { after = typeof entry.after_json === 'string' ? JSON.parse(entry.after_json || '{}') : (entry.after_json || {}); } catch (_) {} return Object.assign({}, before, after, entry, { imei: entry.imei || after.imei || before.imei || '' }); });
      document.querySelector('#app').innerHTML = '<section class="section v36-history"><div class="section-head"><h2>📋 Historial IMEI</h2><button class="btn secondary" id="history-refresh">🔄 Actualizar</button></div><div class="section-body"><input id="history-q" class="input search-field" placeholder="🔍 Buscar IMEI completo o parcial..." value="' + safe(state.historyImei || '') + '"></div><div id="history-results"></div></section>';
      var draw = function () { var query = key(document.querySelector('#history-q').value), out = query ? rows.filter(function (r) { return key(r.imei || r.imei_original).indexOf(query) >= 0; }) : []; window.__historyRows = out; document.querySelector('#history-results').innerHTML = query ? (out.length ? table(out, ['timestamp','action','user_id','imei','modulo','marca','modelo','monto','estado','before_json','after_json']) : '<div class="empty">No hay historial para ese IMEI.</div>') : '<div class="empty">Escribe un IMEI para consultar el historial.</div>'; };
      document.querySelector('#history-q').oninput = draw; document.querySelector('#history-refresh').onclick = renderHistory; draw();
    } catch (error) { errorView('No se pudo cargar Historial IMEI', error, 'renderHistory'); }
  };
}());
