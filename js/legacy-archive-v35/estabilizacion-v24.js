/* v24: capa final de estabilidad.
 * Evita cadenas de wrappers recursivas de versiones anteriores y centraliza
 * los flujos que deben terminar siempre: módulos, mapa e importación.
 */
(function () {
  'use strict';
  var esc24 = function (v) { return typeof safe === 'function' ? safe(v) : String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); };
  var key24 = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim(); };
  var imei24 = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
  var model24 = function (x) { return x.modelo || x.Modelo || ''; };
  var fields24 = [['imei','IMEI'],['marca','MARCA'],['modelo','MODELO'],['n_linea','N° LÍNEA'],['responsable','RESPONSABLE'],['dni','DNI'],['cargo','CARGO'],['tipo','TIPO'],['supervisor','SUPERVISOR'],['zona','ZONA'],['cuenta','CUENTA'],['departamento','DEPARTAMENTO'],['city','CIUDAD'],['estado','ESTADO']];

  function page24(title, group) {
    return '<section class="section module-section"><div class="section-head"><h2>' + title + '</h2><button class="btn secondary" id="v24-refresh">🔄 Actualizar</button></div><div class="section-body"><div class="module-filters"><input id="v24-q" class="input search-field" placeholder="🔍 Buscar IMEI, responsable, modelo o DNI...">' +
      (group ? ['supervisor','zona','cuenta','modelo','tipo','estado'].map(function (f) { return '<select class="select" id="v24-' + f + '"><option value="">' + f.toUpperCase() + '</option></select>'; }).join('') : '') +
      '</div></div><div class="table-wrap module-table"><table><thead><tr>' + fields24.map(function (f) { return '<th>' + f[1] + '</th>'; }).join('') + '<th>ACCIONES</th></tr></thead><tbody id="v24-body"></tbody></table><div class="pagination" id="v24-pager"></div></div></section>';
  }
  function renderDevices24(group) {
    loading('Cargando módulo...');
    var title = group === 'A' ? '🟦 Modelos Antiguos A' : group === 'B' ? '🟧 Modelos Antiguos B' : '📱 Inventario LDU';
    var host = document.querySelector('#app');
    api('listDevices').then(function (response) {
      if (!response || response.status === 'error') throw new Error(response && response.message || 'No se pudo consultar Inventario.');
      var rows = (response.data || []).filter(function (x) { return !group || (typeof groupFor === 'function' ? groupFor(model24(x)) === group : true); });
      host.innerHTML = page24(title, group);
      var ids = group ? ['supervisor','zona','cuenta','modelo','tipo','estado'] : [];
      ids.forEach(function (f) { var el = document.querySelector('#v24-' + f); Array.from(new Set(rows.map(function (x) { return x[f]; }).filter(Boolean))).sort().forEach(function (v) { el.insertAdjacentHTML('beforeend', '<option value="' + esc24(v) + '">' + esc24(v) + '</option>'); }); });
      var page = 1, size = 20;
      function draw() {
        var q = key24(document.querySelector('#v24-q').value);
        var out = rows.filter(function (x) { return (!q || Object.keys(x).some(function (k) { return key24(x[k]).indexOf(q) >= 0; })) && ids.every(function (f) { var v = document.querySelector('#v24-' + f).value; return !v || key24(x[f]) === key24(v); }); });
        var pages = Math.max(1, Math.ceil(out.length / size)); page = Math.min(page, pages); var view = out.slice((page - 1) * size, page * size);
        document.querySelector('#v24-body').innerHTML = view.map(function (x) { return '<tr>' + fields24.map(function (f) { return '<td>' + esc24(displayImportValue(x[f[0]], f[0])) + '</td>'; }).join('') + '<td class="row-actions"><button data-v24="view" data-id="' + esc24(x.imei) + '">👁️</button><button data-v24="history" data-id="' + esc24(x.imei) + '">📜</button><button data-v24="edit" data-id="' + esc24(x.imei) + '">✎️</button></td></tr>'; }).join('') || '<tr><td colspan="16" class="empty">Sin resultados</td></tr>';
        document.querySelector('#v24-pager').innerHTML = '<span>Mostrando ' + (out.length ? (page - 1) * size + 1 : 0) + '–' + Math.min(page * size, out.length) + ' de ' + out.length + '</span><button class="btn secondary" ' + (page === 1 ? 'disabled' : '') + '>‹</button><span>Página ' + page + ' de ' + pages + '</span><button class="btn secondary" ' + (page === pages ? 'disabled' : '') + '>›</button>';
        var pb = document.querySelectorAll('#v24-pager button'); if (pb[0]) pb[0].onclick = function () { page--; draw(); }; if (pb[1]) pb[1].onclick = function () { page++; draw(); };
        document.querySelectorAll('[data-v24]').forEach(function (b) { b.onclick = function () { var row = out.find(function (x) { return imei24(x.imei) === imei24(b.dataset.id); }); if (b.dataset.v24 === 'view' && typeof showDetail === 'function') showDetail(row); if (b.dataset.v24 === 'history') { state.historyImei = b.dataset.id; window.navigate('history'); } if (b.dataset.v24 === 'edit' && typeof openDeviceForm === 'function') openDeviceForm(row); }; });
      }
      document.querySelector('#v24-q').oninput = function () { page = 1; draw(); }; ids.forEach(function (f) { document.querySelector('#v24-' + f).onchange = function () { page = 1; draw(); }; }); document.querySelector('#v24-refresh').onclick = function () { renderDevices24(group); }; draw();
    }).catch(function (e) { errorView('No se pudo cargar el módulo', e, 'renderDevices24'); });
  }
  window.renderDevices = renderDevices = renderDevices24;

  function paintMap24() {
    var host = document.querySelector('#ldu-real-map'); if (!host) return;
    fetch('assets/peru_departamentos.geojson', { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw Error('GeoJSON HTTP ' + r.status); return r.json(); }).then(function (geo) {
      var all = []; (geo.features || []).forEach(function (f) { var g = f.geometry || {}; var ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates || []; ps.forEach(function (poly) { (poly || []).forEach(function (ring) { (ring || []).forEach(function (c) { all.push(c); }); }); }); });
      if (!all.length) throw Error('GeoJSON sin geometrías.'); var xs = all.map(function (c) { return c[0]; }), ys = all.map(function (c) { return c[1]; }), minX = Math.min.apply(Math, xs), maxX = Math.max.apply(Math, xs), minY = Math.min.apply(Math, ys), maxY = Math.max.apply(Math, ys), W = 700, H = 430, pad = 12;
      var proj = function (c) { return [pad + (c[0] - minX) / (maxX - minX || 1) * (W - 2 * pad), H - pad - (c[1] - minY) / (maxY - minY || 1) * (H - 2 * pad)]; }, path = function (ring) { return (ring || []).map(function (c, i) { var p = proj(c); return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' Z'; };
      var rows = state.devices || [], dep = document.querySelector('#map-department') && document.querySelector('#map-department').value, city = document.querySelector('#map-city') && document.querySelector('#map-city').value, cuenta = document.querySelector('#map-account') && document.querySelector('#map-account').value;
      rows = rows.filter(function (x) { return (!dep || key24(x.departamento) === key24(dep)) && (!city || key24(x.city) === key24(city)) && (!cuenta || key24(x.cuenta) === key24(cuenta)); }); var counts = {}; rows.forEach(function (x) { var k = key24(x.departamento || 'SIN REGIÓN'); counts[k] = (counts[k] || 0) + 1; }); var max = Math.max(1, ...Object.values(counts));
      host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa del Perú">' + (geo.features || []).map(function (f) { var g = f.geometry || {}, ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates || [], name = f.properties && (f.properties.NOMBDEP || f.properties.name) || '', d = []; ps.forEach(function (poly) { (poly || []).forEach(function (ring) { d.push(path(ring)); }); }); var n = counts[key24(name)] || 0; return '<path d="' + d.join(' ') + '" fill="' + (n ? 'hsl(224 75% ' + (78 - Math.round(n / max * 38)) + '%)' : '#e2e8f0') + '" data-dep="' + esc24(name) + '"><title>' + esc24(name) + ': ' + n + ' equipos</title></path>'; }).join('') + '</svg>';
      var legend = document.querySelector('#map-legend'); if (legend) legend.textContent = rows.length + ' LDU · ' + Object.keys(counts).length + ' departamentos'; document.querySelectorAll('#ldu-real-map [data-dep]').forEach(function (p) { p.onclick = function () { var el = document.querySelector('#map-department'); if (el) { Array.from(el.options).some(function (o) { if (key24(o.value) === key24(p.dataset.dep)) { el.value = o.value; return true; } }); el.dispatchEvent(new Event('change')); } }; });
    }).catch(function (e) { host.innerHTML = '<div class="error">No se pudo cargar el mapa del Perú: ' + esc24(e.message) + '</div>'; });
  }
  window.mapSection = mapSection = function () { var rows = state.devices || [], opts = function (f, label) { return '<select id="map-' + f + '" class="select"><option value="">' + label + '</option>' + Array.from(new Set(rows.map(function (x) { return x[f]; }).filter(Boolean))).sort().map(function (v) { return '<option value="' + esc24(v) + '">' + esc24(v) + '</option>'; }).join('') + '</select>'; }; setTimeout(paintMap24, 0); return '<section class="section map-section"><div class="section-head"><h2>📍 Mapeo de LDU por Departamento</h2><div class="map-filters">' + opts('departamento', '📍 Departamentos') + opts('city', '🏙️ Ciudades') + opts('cuenta', '🏢 Cuentas') + '</div></div><div class="map-content"><div><div id="ldu-real-map" class="v16-real-map"><div class="loading">Cargando mapa del Perú...</div></div><div id="map-legend" class="map-legend"></div></div><div id="map-table"></div></div></section>'; };
  ['departamento','city','cuenta'].forEach(function (f) { document.addEventListener('change', function (e) { if (e.target && e.target.id === 'map-' + f) paintMap24(); }); });

  window.previewImport = previewImport = async function (file, module, cardHost) {
    try {
      var book = XLSX.read(await file.arrayBuffer(), { type: 'array' }), sheet = book.Sheets[book.SheetNames[0]], raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }), rows = canonicalizeImportRows(raw, module); if (!rows.length) throw Error('El archivo no contiene registros.');
      var drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.innerHTML = '<aside class="drawer-card import-preview-card"><div class="section-head"><h2>📥 Vista previa de importación</h2><button class="btn secondary" id="v24-close">✕</button></div><p><b>Registros:</b> ' + rows.length + '</p>' + table(rows.slice(0, 10), Object.keys(rows[0])) + '<div id="v24-progress" class="form-note">Listo para importar.</div><div id="v24-result"></div><div class="form-actions"><button class="btn secondary" id="v24-cancel">Cancelar</button><button class="btn" id="v24-confirm">📥 IMPORTAR</button></div></aside>'; document.body.appendChild(drawer);
      var close = function () { drawer.remove(); }; drawer.querySelector('#v24-close').onclick = close; drawer.querySelector('#v24-cancel').onclick = close; drawer.querySelector('#v24-confirm').onclick = async function () { var b = drawer.querySelector('#v24-confirm'), p = drawer.querySelector('#v24-progress'), out = drawer.querySelector('#v24-result'), inserted = 0, updated = 0, rejected = 0; b.disabled = true; try { var size = 25; for (var i = 0; i < rows.length; i += size) { var batch = rows.slice(i, i + size), r = await Promise.race([api('importRows', { module: module, rows: batch, userId: 'importacion' }), new Promise(function (_, reject) { setTimeout(function () { reject(Error('La API no respondió durante el lote.')); }, 90000); })]); if (!r || r.status !== 'ok') throw Error(r && r.message || 'El servidor rechazó el lote.'); var d = r.data || {}; inserted += Number(d.inserted || d.imported || 0); updated += Number(d.updated || 0); rejected += Number(d.errores || d.rejected || (d.errors || []).length || 0); p.textContent = 'Procesando ' + Math.min(i + batch.length, rows.length) + ' de ' + rows.length + ' registros...'; out.textContent = 'Nuevos: ' + inserted + ' · Actualizados: ' + updated + ' · Rechazados: ' + rejected; } p.textContent = '✅ Importación completada'; b.disabled = false; setTimeout(function () { close(); navigate(module === 1 ? 'incidents' : module >= 2 ? 'stock' : 'inventory'); }, 700); } catch (e) { b.disabled = false; p.textContent = '❌ ' + e.message; out.textContent = 'La importación se detuvo; puedes corregir el archivo y volver a intentarlo.'; } };
    } catch (e) { if (cardHost) cardHost.textContent = 'Error: ' + e.message; else alert(e.message); }
  };
}());
