/* v17: capa final de estabilidad. Centraliza clasificación IMEI y paginación de Stock. */
(function () {
  'use strict';
  const cfg = window.LDU_CONFIG || {};
  const key = v => String(v == null ? '' : v).replace(/\D/g, '');
  const text = v => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const out = v => typeof safe === 'function' ? safe(v) : esc(v == null ? '—' : v);
  function classify(devices, stock) {
    const d = new Set((devices || []).map(x => key(x.imei)).filter(Boolean));
    const s = new Set((stock || []).map(x => key(x.imei)).filter(Boolean));
    const noVivo = (devices || []).filter(x => key(x.imei) && !s.has(key(x.imei)));
    const noInventario = (stock || []).filter(x => key(x.imei) && !d.has(key(x.imei)));
    (devices || []).forEach(x => { x.en_inventario = s.has(key(x.imei)) ? 'SI' : 'NO VIVO'; });
    (stock || []).forEach(x => { x.en_inventario = d.has(key(x.imei)) ? 'SI' : 'NO EN INVENTARIO'; });
    state.sync = { devicesInStock: (devices || []).filter(x => s.has(key(x.imei))), noVivo, noInventario, devices: devices || [], stock: stock || [] };
    return state.sync;
  }
  window.lduClassify = classify;
  function loginView(message) {
    document.querySelector('#page-title').textContent = 'Inicio de sesión';
    document.querySelector('#main-nav').innerHTML = '';
    document.querySelector('.global-actions').innerHTML = '<span class="status-pill">Autenticación requerida</span>';
    document.querySelector('#app').innerHTML = `<section class="auth-screen"><form class="section auth-card" id="ldu-login"><h2>🔐 Inicio de sesión</h2><p>Ingresa con un usuario autorizado para acceder al Sistema de Gestión LDU.</p><label class="full-field"><span>Usuario</span><input class="input" name="username" autocomplete="username" required></label><label class="full-field"><span>Contraseña</span><input class="input" name="password" type="password" autocomplete="current-password" required></label><p class="auth-error">${out(message || '')}</p><button class="btn" type="submit">Ingresar</button></form></section>`;
    document.querySelector('#ldu-login').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), username = String(f.get('username')).trim(), password = String(f.get('password')); try { const r = await api('login', { usuario: username, password }); if (r.status !== 'ok') throw Error(r.message || 'Usuario o contraseña incorrectos.'); sessionStorage.setItem('ldu-authenticated', '1'); sessionStorage.setItem('ldu-session', JSON.stringify(r.data || {})); window.location.reload(); } catch (err) { loginView(err.message || 'No se pudo autenticar.'); } };
  }
  const authenticated = () => !cfg.AUTH_ENABLED || sessionStorage.getItem('ldu-authenticated') === '1';
  const originalNavigate = window.navigate;
  window.navigate = function (view) { if (!authenticated() && view !== 'login') return loginView(); return originalNavigate(view); };
  if (cfg.AUTH_ENABLED && !authenticated()) loginView();
  const originalLoadAll = window.loadAll;
  window.loadAll = async function () { const result = await originalLoadAll(); classify(state.devices, state.stock); return result; };
  window.renderStock = async function () {
    loading('Cargando Stock...');
    try {
      const [sr, dr] = await Promise.all([api('listStock'), api('listDevices')]);
      if (sr.status === 'error') throw Error(sr.message);
      const stock = sr.data || [], devices = dr.data || []; state.stock = stock; state.devices = devices; const sync = classify(devices, stock);
      const options = (field, label) => `<option value="">${label}</option>${[...new Set(stock.map(x => x[field]).filter(Boolean))].sort().map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}`;
      document.querySelector('#app').innerHTML = `<section class="section stock-screen"><div class="section-head"><h2>📦 Stock</h2><div><button class="btn secondary" id="stock-refresh">🔄 Actualizar</button><button class="btn secondary" id="stock-export">📄 Exportar Excel</button></div></div><div class="cards module-cards"><div class="metric"><strong>${stock.length}</strong><span>Total en Stock</span></div><div class="metric"><strong>${sync.devicesInStock.length}</strong><span>En inventario</span></div><div class="metric"><strong>${sync.noVivo.length}</strong><span>IMEI no vivo</span></div><div class="metric"><strong>${sync.noInventario.length}</strong><span>No en inventario</span></div></div><div class="section-body"><div class="toolbar"><input id="stock-q" class="input" placeholder="Buscar IMEI, cuenta, marca o modelo..."><select id="stock-cuenta" class="select">${options('cuenta','Cuenta')}</select><select id="stock-marca" class="select">${options('marca','Marca')}</select><select id="stock-modelo" class="select">${options('modelo','Modelo')}</select><select id="stock-inv" class="select"><option value="">En Inventario</option><option>SI</option><option>NO</option><option>NO VIVO</option></select></div></div><div class="table-wrap module-table"><table><thead><tr><th>Cuenta</th><th>IMEI</th><th>Marca</th><th>Modelo</th><th>Monto S/</th><th>Fecha de ingreso</th><th>En Inventario</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody id="stable-body"></tbody></table><div class="pagination" id="stable-pager"></div></div></section>`;
      const filtered = () => { const q = text(document.querySelector('#stock-q').value), inv = document.querySelector('#stock-inv').value; return stock.filter(x => (!q || Object.values(x).some(v => text(v).includes(q))) && (!document.querySelector('#stock-cuenta').value || text(x.cuenta) === text(document.querySelector('#stock-cuenta').value)) && (!document.querySelector('#stock-marca').value || text(x.marca) === text(document.querySelector('#stock-marca').value)) && (!document.querySelector('#stock-modelo').value || text(x.modelo) === text(document.querySelector('#stock-modelo').value)) && (!inv || (inv === 'NO' ? x.en_inventario === 'NO EN INVENTARIO' : text(x.en_inventario) === text(inv)))); };
      let page = 1; const size = 20;
      const draw = () => { const rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / size)); page = Math.min(page, pages); const view = rows.slice((page - 1) * size, page * size); document.querySelector('#stable-body').innerHTML = view.map(x => { const cls = x.en_inventario === 'SI' ? 'si' : x.en_inventario === 'NO VIVO' ? 'no-vivo' : 'no-inventario'; return `<tr><td>${out(x.cuenta)}</td><td>${out(x.imei)}</td><td>${out(x.marca)}</td><td>${out(x.modelo)}</td><td>${out(money(x.monto))}</td><td>${out(displayImportValue(x.fecha_ingreso, 'fecha_ingreso'))}</td><td class="stock-classification ${cls}">${out(x.en_inventario)}</td><td>${badge(x.estado_inventario || x.estado)}</td><td>${out(x.observaciones)}</td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">Sin resultados</td></tr>'; document.querySelector('#stable-pager').innerHTML = `<span>Mostrando ${rows.length ? (page - 1) * size + 1 : 0}–${Math.min(page * size, rows.length)} de ${rows.length}</span><button class="btn secondary" ${page === 1 ? 'disabled' : ''}>‹</button><span>Página ${page} de ${pages}</span><button class="btn secondary" ${page === pages ? 'disabled' : ''}>›</button>`; const b = document.querySelectorAll('#stable-pager button'); if (b[0]) b[0].onclick = () => { page--; draw(); }; if (b[1]) b[1].onclick = () => { page++; draw(); }; };
      ['stock-q','stock-cuenta','stock-marca','stock-modelo','stock-inv'].forEach(id => document.querySelector('#' + id).oninput = () => { page = 1; draw(); }); document.querySelector('#stock-refresh').onclick = renderStock; document.querySelector('#stock-export').onclick = () => exportRows(filtered(), 'stock'); draw();
    } catch (e) { errorView('No se pudo cargar Stock', e, 'renderStock'); }
  };
}());
