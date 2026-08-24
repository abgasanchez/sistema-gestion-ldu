/* Capa final de estabilidad. Se carga después de las capas históricas para
 * evitar que una implementación antigua vuelva a tomar el control. */
(function () {
  const readActions = new Set(['health', 'listDevices', 'listIncidents', 'listStock', 'listHistory', 'listUsers', 'listNotifications', 'listDeleted']);
  const pending = new Map();
  const cache = new Map();
  const cacheTtl = 15000;
  const baseApi = window.api;

  function requestKey(action, payload) {
    return action + '|' + JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
  }

  window.api = api = async function (action, payload) {
    const key = requestKey(action, payload);
    if (readActions.has(action)) {
      const hit = cache.get(key);
      if (hit && hit.expires > Date.now()) return hit.value;
      if (pending.has(key)) return pending.get(key);
    }
    const request = Promise.resolve().then(() => baseApi(action, payload)).then(function (result) {
      if (readActions.has(action)) cache.set(key, { value: result, expires: Date.now() + cacheTtl });
      else cache.clear();
      return result;
    }).finally(function () { pending.delete(key); });
    if (readActions.has(action)) pending.set(key, request);
    return request;
  };

  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  }
  function imei(row) { return normalize(row && (row.imei || row.imei_original)).replace(/\D/g, ''); }
  function mergeInto(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '' && (target[key] === undefined || target[key] === null || target[key] === '')) target[key] = source[key];
    });
    if (!target.responsable && target.nombre) target.responsable = target.nombre;
    if (!target.nombre && target.responsable) target.nombre = target.responsable;
    if (!target.dni && source && source.DNI) target.dni = source.DNI;
    return target;
  }

  function canonicalRows(deviceRows, stockRows, incidentRows) {
    const byImei = new Map(), loose = [];
    function add(row, module) {
      const copy = Object.assign({}, row, { modulo: row.modulo || module, imei: row.imei || row.imei_original || '' });
      const key = imei(copy);
      if (!key) { loose.push(copy); return; }
      if (!byImei.has(key)) byImei.set(key, copy);
      else mergeInto(byImei.get(key), copy);
    }
    (deviceRows || []).forEach(function (row) { add(row, groupFor(row.modelo) === 'A' ? 'Modelos Ant. A' : groupFor(row.modelo) === 'B' ? 'Modelos Ant. B' : 'Inventario LDU'); });
    (stockRows || []).forEach(function (row) { add(row, 'Stock'); });
    (incidentRows || []).forEach(function (row) { add(row, 'Incidencias'); });
    return Array.from(byImei.values()).concat(loose);
  }

  function cardValue(row, key) {
    const value = row[key];
    if (key === 'monto') return typeof amount === 'function' ? amount(value) : (value || '—');
    if (key === 'estado') return typeof badge === 'function' ? badge(value || row.estado_proceso) : (value || row.estado_proceso || '—');
    return esc(value == null || value === '' ? '—' : value);
  }

  window.renderSearch = renderSearch = async function () {
    loading('Cargando Buscador...');
    try {
      const response = await Promise.all([api('listDevices'), api('listStock'), api('listIncidents')]);
      const rows = canonicalRows(response[0].data, response[1].data, response[2].data);
      const fields = ['modulo', 'imei', 'marca', 'modelo', 'n_linea', 'responsable', 'dni', 'cargo', 'tipo', 'supervisor', 'zona', 'cuenta', 'departamento', 'city', 'tienda', 'tipo_uso', 'fecha_asignacion', 'fecha_ingreso', 'monto', 'estado', 'estado_proceso', 'en_inventario', 'estado_inventario', 'guia', 'observaciones'];
      const cardFields = [['📱 IMEI', 'imei'], ['📱 MODELO', 'modelo'], ['📦 MÓDULO', 'modulo'], ['📊 ESTADO', 'estado'], ['📦 INVENTARIO', 'en_inventario'], ['👤 RESPONSABLE', 'responsable'], ['🪪 DNI', 'dni'], ['👤 SUPERVISOR', 'supervisor'], ['📍 ZONA', 'zona'], ['🏢 CUENTA', 'cuenta'], ['🗺️ DEPARTAMENTO', 'departamento'], ['🏙️ CIUDAD', 'city'], ['🏪 TIENDA', 'tienda'], ['📅 FECHA ASIGNACIÓN', 'fecha_asignacion'], ['💰 MONTO S/', 'monto']];
      document.querySelector('#app').innerHTML = '<section class="section v36-search"><div class="section-head"><h2>🔎 Buscador</h2><button class="btn secondary" id="v36-refresh">🔄 Actualizar</button></div><div class="section-body"><div class="toolbar"><input id="v36-q" class="input search-field" placeholder="🔍 Buscar IMEI, DNI, nombre, modelo..."><select id="v36-module" class="select"><option value="">Todos los módulos</option><option>Inventario LDU</option><option>Modelos Ant. A</option><option>Modelos Ant. B</option><option>Stock</option><option>Incidencias</option></select></div></div><div id="v36-cards"></div><div id="v36-results"><div class="empty">Escribe un término para buscar.</div></div></section>';
      let sequence = 0;
      const draw = function () {
        const current = ++sequence, query = normalize(document.querySelector('#v36-q').value), module = document.querySelector('#v36-module').value;
        const out = query ? rows.filter(function (row) { return (!module || row.modulo === module) && Object.keys(row).some(function (key) { return key.charAt(0) !== '_' && normalize(row[key]).indexOf(query) >= 0; }); }) : [];
        const digits = query.replace(/\D/g, ''), imeiQuery = digits.length >= 10 && out.some(function (row) { return String(row.imei || '').replace(/\D/g, '') === digits; });
        window.__searchRows = out;
        if (current !== sequence) return;
        document.querySelector('#v36-results').innerHTML = query ? (out.length ? table(out, fields) : '<div class="empty">Sin resultados.</div>') : '<div class="empty">Escribe un término para buscar.</div>';
        document.querySelector('#v36-cards').innerHTML = imeiQuery ? '<div class="cards compact v36-card-grid">' + cardFields.map(function (field) { return '<div class="metric"><strong>' + cardValue(out[0], field[1]) + '</strong><span>' + field[0] + '</span></div>'; }).join('') + '</div>' : (out.length ? '<div class="cards compact v36-search-summary"><div class="metric"><strong>' + out.length + '</strong><span>📊 REGISTROS ENCONTRADOS</span></div><div class="metric"><strong>' + cardValue({ monto: out.reduce(function (sum, row) { return sum + Number(row.monto || row.valor || 0); }, 0) }, 'monto') + '</strong><span>💰 MONTO TOTAL</span></div><div class="metric"><strong>' + (query || '—') + '</strong><span>🔎 CRITERIO DE BÚSQUEDA</span></div></div>' : '');
      };
      document.querySelector('#v36-q').oninput = draw;
      document.querySelector('#v36-module').onchange = draw;
      document.querySelector('#v36-refresh').onclick = renderSearch;
      draw();
    } catch (error) { errorView('No se pudo cargar Buscador', error, 'renderSearch'); }
  };

  window.renderUsers = renderUsers = async function () {
    document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>👥 Usuarios</h2><div class="toolbar"><button class="btn secondary" id="v36-users-refresh">🔄 Actualizar</button><button class="btn" id="v36-new-user">＋ Nuevo Usuario</button></div></div><div id="users-results"><div class="loading">Cargando usuarios...</div></div></section>';
    document.querySelector('#v36-users-refresh').onclick = renderUsers;
    document.querySelector('#v36-new-user').onclick = openUserForm;
    try {
      const result = await api('listUsers');
      const rows = result.data || [];
      document.querySelector('#users-results').innerHTML = '<div class="table-wrap"><table><thead><tr><th>ID</th><th>USUARIO</th><th>NOMBRE</th><th>ROL</th><th>CORREO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>' + rows.map((user, index) => '<tr><td>' + safe(user.user_id) + '</td><td>' + safe(user.username) + '</td><td>' + safe(user.name) + '</td><td>' + safe(user.role) + '</td><td>' + safe(user.email) + '</td><td>' + badge(user.active === false || String(user.active).toLowerCase() === 'no' ? 'Inactivo' : 'Activo') + '</td><td class="row-actions"><button type="button" class="btn secondary" data-v36-user="edit" data-index="' + index + '">✏️ Editar</button><button type="button" class="btn secondary" data-v36-user="toggle" data-index="' + index + '">⏻ Estado</button><button type="button" class="btn danger" data-v36-user="delete" data-index="' + index + '">🗑️ Eliminar</button></td></tr>').join('') + '</tbody></table></div>';
      document.querySelectorAll('[data-v36-user]').forEach(button => button.onclick = async function () { const user = rows[Number(button.dataset.index)]; if (!user) return; if (button.dataset.v36User === 'edit') return openUserEditor(user); if (button.dataset.v36User === 'toggle') { button.disabled = true; await api('updateUser', { userId: user.user_id, user: { active: !(user.active === true || ['sí','si','true'].includes(String(user.active).toLowerCase())) } }); return renderUsers(); } if (button.dataset.v36User === 'delete' && confirm('¿Eliminar este usuario? Esta acción quedará registrada.')) { button.disabled = true; await api('deleteUser', { userId: user.user_id, userIdTarget: user.user_id }); return renderUsers(); } });
    } catch (error) { errorView('No se pudo cargar Usuarios', error, 'renderUsers'); }
  };

  function openUserEditor(user) {
    const drawer = document.createElement('div'); drawer.className = 'drawer';
    drawer.innerHTML = '<aside class="drawer-card"><div class="section-head"><h2>✏️ Editar usuario</h2><button type="button" class="btn secondary" data-v36-close>✕</button></div><form class="device-form">' + field('Usuario *', 'username', 'text', user.username || '', 'required') + field('Nombre completo', 'name', 'text', user.name || '') + field('Nueva contraseña', 'password', 'password', '', 'minlength="4"') + selectField('Rol', 'role', ['Consulta', 'Operador', 'Supervisor', 'Administrador'], user.role || 'Consulta') + field('Correo electrónico', 'email', 'email', user.email || '') + '<div id="v36-user-message"></div><div class="form-actions"><button type="button" class="btn secondary" data-v36-cancel>Cancelar</button><button class="btn" type="submit">💾 Guardar cambios</button></div></form></aside>';
    document.body.appendChild(drawer); const close = () => drawer.remove(); drawer.querySelector('[data-v36-close]').onclick = close; drawer.querySelector('[data-v36-cancel]').onclick = close;
    drawer.querySelector('form').onsubmit = async event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.target).entries()); value.user_id = user.user_id; if (!value.password) delete value.password; const result = await api('updateUser', { userId: user.user_id, user: value }); if (result.status !== 'ok') drawer.querySelector('#v36-user-message').textContent = result.message || 'No se pudo actualizar el usuario.'; else { close(); renderUsers(); } };
  }

  /* Configuración: operaciones de mantenimiento protegidas por hoja. */
  window.renderSettings = renderSettings = function () {
    const cleanup = [['INVENTORY','📱 Inventario LDU'],['MODEL_A','🟦 Modelos Antiguos A'],['MODEL_B','🟧 Modelos Antiguos B'],['STOCK','📦 Stock'],['INCIDENTS','⚠️ Incidencias'],['HISTORY','📋 Historial IMEI'],['NOTIFICATIONS','🔔 Notificaciones']];
    document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>⚙️ Configuración</h2></div><div class="settings-grid"><article class="section"><h3>🔐 Seguridad</h3><form id="password-form" class="device-form">' + field('Contraseña actual', 'current_password', 'password', '', 'required') + field('Nueva contraseña', 'new_password', 'password', '', 'required minlength="4"') + field('Confirmar contraseña', 'confirm_password', 'password', '', 'required minlength="4"') + '<button class="btn">🔐 Cambiar contraseña</button></form></article><article class="section"><h3>🛠️ Mantenimiento</h3><div class="toolbar"><button class="btn" id="v36-health">🔌 Probar conexión</button><button class="btn secondary" id="v36-validate">📋 Validar estructura</button></div><p class="muted">Las limpiezas requieren seleccionar una hoja, escribir la confirmación exacta y confirmar la acción.</p></article></div><section class="section"><div class="section-head"><h3>🧹 Limpieza protegida por hoja</h3></div><p>Se conservarán los encabezados. Esta acción elimina los registros de la hoja seleccionada y no se puede deshacer.</p><div class="settings-buttons">' + cleanup.map(item => '<button type="button" class="btn danger" data-v36-clean="' + item[0] + '">' + item[1] + '</button>').join('') + '</div></section></section>';
    document.querySelector('#v36-health').onclick = function () { api('health').then(function (r) { alert(r.message || 'Conexión activa'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#v36-validate').onclick = function () { api('setup').then(function (r) { alert(r.message || 'Estructura validada'); }).catch(function (e) { alert(e.message); }); };
    document.querySelectorAll('[data-v36-clean]').forEach(button => button.onclick = async function () { const key = button.dataset.v36Clean; const confirmation = prompt('Para continuar escribe exactamente: LIMPIAR ' + key); if (confirmation !== 'LIMPIAR ' + key) return; if (!confirm('¿Confirmas la limpieza de la hoja seleccionada?')) return; button.disabled = true; try { const result = await api('clearSheet', { sheetKey: key, confirmation, userId: 'admin' }); alert(result.message || 'Limpieza completada.'); } catch (error) { alert('No se pudo limpiar la hoja: ' + error.message); } finally { button.disabled = false; } });
    document.querySelector('#password-form').onsubmit = function (event) { event.preventDefault(); const form = new FormData(event.target); if (form.get('new_password') !== form.get('confirm_password')) alert('Las contraseñas no coinciden.'); else alert('La solicitud de cambio está lista para conectarse con Apps Script.'); };
  };

  window.exportLduAnalysis = function () {
    const selected = document.querySelector('.v32-account.selected')?.dataset.v32Account || '';
    const rows = (state.devices || []).filter(row => !selected || normalize(row.cuenta) === normalize(selected));
    exportRows(rows, 'analisis-ldu-' + (selected || 'todos'));
  };
  const baseMapSection = window.mapSection;
  if (typeof baseMapSection === 'function') window.mapSection = mapSection = function () {
    return baseMapSection().replace('<span>Datos calculados desde Inventario, Modelos A y Modelos B</span>', '<span>Datos calculados desde Inventario, Modelos A y Modelos B</span><button type="button" class="btn secondary" onclick="exportLduAnalysis()">📤 Exportar</button>');
  };

  window.renderHistory = renderHistory = async function () {
    loading('Cargando Historial IMEI...');
    try {
      const response = await api('listHistory'); if (response.status === 'error') throw Error(response.message);
      const raw = response.data || [], rows = raw.map(function (entry) { let snapshot = {}; try { snapshot = typeof entry.after_json === 'string' ? JSON.parse(entry.after_json || '{}') : (entry.after_json || {}); } catch (_) {} return Object.assign({}, snapshot, entry); });
      const fields = ['timestamp','action','user_id','imei','marca','modelo','n_linea','responsable','dni','cargo','tipo','supervisor','zona','cuenta','departamento','city','canal','tienda','tipo_uso','fecha_asignacion','monto','estado','observaciones'];
      document.querySelector('#app').innerHTML = '<section class="section v36-history"><div class="section-head"><h2>📋 Historial IMEI</h2><button class="btn secondary" id="v36-hrefresh">🔄 Actualizar</button></div><div id="v36-hcards"></div><div class="section-body"><input id="v36-hq" class="input search-field" placeholder="🔍 Buscar IMEI completo o parcial..."></div><div id="v36-hresults"></div></section>';
      const draw = function () { const query = normalize(document.querySelector('#v36-hq').value); const out = query ? rows.filter(row => normalize(row.imei).includes(query)) : []; const first = out[0] || {}; const total = out.reduce((sum, row) => sum + Number(row.monto || row.valor || 0), 0); document.querySelector('#v36-hcards').innerHTML = out.length ? '<div class="cards compact v36-history-cards">' + [['📱 MODELO','modelo'],['👤 RESPONSABLE','responsable'],['📊 ESTADO','estado'],['👤 SUPERVISOR','supervisor'],['📍 ZONA','zona'],['🏢 CUENTA','cuenta'],['📅 FECHA','timestamp'],['💰 MONTO TOTAL',null]].map(function (item) { return '<div class="metric"><strong>' + (item[1] ? cardValue(first, item[1]) : cardValue({ monto: total }, 'monto')) + '</strong><span>' + item[0] + '</span></div>'; }).join('') + '</div>' : ''; window.__historyRows = out; document.querySelector('#v36-hresults').innerHTML = query ? (out.length ? table(out, fields) : '<div class="empty">No hay historial para ese IMEI.</div>') : '<div class="empty">Escribe un IMEI para consultar el historial.</div>'; };
      document.querySelector('#v36-hq').oninput = draw; document.querySelector('#v36-hrefresh').onclick = renderHistory; draw();
    } catch (error) { errorView('No se pudo cargar Historial IMEI', error, 'renderHistory'); }
  };

  const baseImport = window.renderImport;
  window.renderImport = renderImport = function () { baseImport(); const head = document.querySelector('#app .section-head'); if (!head) return; head.style.display = 'flex'; head.style.alignItems = 'center'; const description = [...head.children].find(child => child.tagName === 'SPAN'); const refresh = [...head.children].find(child => child.tagName === 'BUTTON'); if (description) { description.style.marginLeft = 'auto'; description.style.order = '2'; } if (refresh) { refresh.style.order = '3'; refresh.style.marginLeft = '0'; } };
})();
