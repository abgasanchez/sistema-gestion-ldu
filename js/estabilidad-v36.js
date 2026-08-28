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
    if (typeof formatVisibleValue === 'function' && value != null && value !== '') return esc(formatVisibleValue(value, key));
    return esc(value == null || value === '' ? '—' : value);
  }

  window.renderSearch = renderSearch = async function () {
    loading('Cargando Buscador...');
    try {
      const response = await Promise.all([api('listDevices'), api('listStock'), api('listIncidents')]);
      const rows = canonicalRows(response[0].data, response[1].data, response[2].data);
      const fields = ['modulo', 'imei', 'marca', 'modelo', 'n_linea', 'responsable', 'dni', 'cargo', 'tipo', 'supervisor', 'zona', 'cuenta', 'departamento', 'ciudad', 'tienda', 'tipo_uso', 'fecha_asignacion', 'fecha_ingreso', 'monto', 'estado', 'estado_proceso', 'en_inventario', 'estado_inventario', 'guia', 'observaciones'];
      const cardFields = [['📱 IMEI', 'imei'], ['📱 MODELO', 'modelo'], ['📦 MÓDULO', 'modulo'], ['📊 ESTADO', 'estado'], ['📦 INVENTARIO', 'en_inventario'], ['👤 RESPONSABLE', 'responsable'], ['🪪 DNI', 'dni'], ['👤 SUPERVISOR', 'supervisor'], ['📍 ZONA', 'zona'], ['🏢 CUENTA', 'cuenta'], ['🗺️ DEPARTAMENTO', 'departamento'], ['🏙️ CIUDAD', 'ciudad'], ['🏪 TIENDA', 'tienda'], ['📅 FECHA ASIGNACIÓN', 'fecha_asignacion'], ['💰 MONTO S/', 'monto']];
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
      document.querySelector('#users-results').innerHTML = '<div class="table-wrap"><table><thead><tr><th>ID</th><th>USUARIO</th><th>NOMBRE</th><th>ROL</th><th>CORREO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>' + rows.map((user, index) => '<tr><td>' + safe(user.id_usuario) + '</td><td>' + safe(user.usuario) + '</td><td>' + safe(user.nombre) + '</td><td>' + safe(user.rol) + '</td><td>' + safe(user.correo) + '</td><td>' + badge(user.activo === false || String(user.activo).toLowerCase() === 'no' ? 'Inactivo' : 'Activo') + '</td><td class="row-actions"><button type="button" class="btn secondary" data-v36-user="edit" data-index="' + index + '">✏️ Editar</button><button type="button" class="btn secondary" data-v36-user="toggle" data-index="' + index + '">⏻ Estado</button><button type="button" class="btn danger" data-v36-user="delete" data-index="' + index + '">🗑️ Eliminar</button></td></tr>').join('') + '</tbody></table></div>';
      document.querySelectorAll('[data-v36-user]').forEach(button => button.onclick = async function () { const user = rows[Number(button.dataset.index)]; if (!user) return; if (button.dataset.v36User === 'edit') return openUserEditor(user); if (button.dataset.v36User === 'toggle') { button.disabled = true; await api('updateUser', { userId: user.id_usuario, user: { activo: (user.activo === true || ['sí','si','true'].includes(String(user.activo).toLowerCase())) ? 'No' : 'Sí' } }); return renderUsers(); } if (button.dataset.v36User === 'delete' && confirm('¿Eliminar este usuario? Esta acción quedará registrada.')) { button.disabled = true; await api('deleteUser', { userId: user.id_usuario, userIdTarget: user.id_usuario }); return renderUsers(); } });
    } catch (error) { errorView('No se pudo cargar Usuarios', error, 'renderUsers'); }
  };

  function openUserEditor(user) {
    const drawer = document.createElement('div'); drawer.className = 'drawer';
    drawer.innerHTML = '<aside class="drawer-card"><div class="section-head"><h2>✏️ Editar usuario</h2><button type="button" class="btn secondary" data-v36-close>✕</button></div><form class="device-form">' + field('Usuario *', 'usuario', 'text', user.usuario || '', 'required') + field('Nombre completo', 'nombre', 'text', user.nombre || '') + field('Nueva contraseña', 'password', 'password', '', 'minlength="4"') + selectField('Rol', 'rol', ['Consulta', 'Operador', 'Supervisor', 'Administrador'], user.rol || 'Consulta') + field('Correo electrónico', 'correo', 'email', user.correo || '') + '<div id="v36-user-message"></div><div class="form-actions"><button type="button" class="btn secondary" data-v36-cancel>Cancelar</button><button class="btn" type="submit">💾 Guardar cambios</button></div></form></aside>';
    document.body.appendChild(drawer); const close = () => drawer.remove(); drawer.querySelector('[data-v36-close]').onclick = close; drawer.querySelector('[data-v36-cancel]').onclick = close;
    drawer.querySelector('form').onsubmit = async event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.target).entries()); value.id_usuario = user.id_usuario; if (!value.password) delete value.password; const result = await api('updateUser', { userId: user.id_usuario, user: value }); if (result.status !== 'ok') drawer.querySelector('#v36-user-message').textContent = result.message || 'No se pudo actualizar el usuario.'; else { close(); renderUsers(); } };
  }

  /* Configuración: operaciones de mantenimiento protegidas por hoja. */
  function _v36CurrentUser_() { let raw = sessionStorage.getItem('ldu-session') || localStorage.getItem('lduUser') || localStorage.getItem('currentUser') || '{}', user = {}; try { user = JSON.parse(raw); } catch (_) {} user = user.data || user; return { username: user.usuario || user.username || 'admin', role: String(user.rol || user.role || '').trim() }; }
  window.renderSettings = renderSettings = function () {
    const cleanup = [['INVENTORY','📱 Inventario LDU'],['MODEL_A','🟦 Modelos Antiguos A'],['MODEL_B','🟧 Modelos Antiguos B'],['STOCK','📦 Stock'],['STOCK_A','🟦📦 Stock Mod. A'],['STOCK_B','🟧📦 Stock Mod. B'],['INCIDENTS','⚠️ Incidencias'],['HISTORY','📋 Historial IMEI'],['NOTIFICATIONS','🔔 Notificaciones']];
    const currentUser = _v36CurrentUser_(), isAdmin = /^admin/i.test(currentUser.role) || currentUser.username === 'admin';
    const maintenance = !isAdmin ? '<p class="muted">El mantenimiento avanzado y la limpieza de hojas están reservados al rol Administrador.</p>' :
      '<div class="toolbar"><button class="btn" id="v36-health">🔌 Probar conexión</button><button class="btn secondary" id="v36-validate">📋 Validar estructura</button><button class="btn secondary" id="v36-reconcile">🔄 Sincronizar Stock por grupos</button><button class="btn secondary" id="v36-standardize">🧹 Estandarizar formatos</button></div><p class="muted">Las limpiezas requieren seleccionar una hoja, escribir la confirmación exacta y confirmar la acción.</p>';
    document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>⚙️ Configuración</h2></div><div class="settings-grid"><article class="section"><h3>🔐 Seguridad</h3><form id="password-form" class="device-form">' + field('Contraseña actual', 'current_password', 'password', '', 'required') + field('Nueva contraseña', 'new_password', 'password', '', 'required minlength="4"') + field('Confirmar contraseña', 'confirm_password', 'password', '', 'required minlength="4"') + '<button class="btn">🔐 Cambiar contraseña</button></form></article><article class="section"><h3>🛠️ Mantenimiento</h3>' + maintenance + '</article></div>' + (isAdmin ? '<section class="section clean-panel"><div class="section-head"><h3>🧹 Limpieza protegida por hoja</h3></div><p>Se conservarán los encabezados. Esta acción elimina los registros de la hoja seleccionada y no se puede deshacer.</p><div class="settings-buttons">' + cleanup.map(item => '<button type="button" class="btn danger" data-v36-clean="' + item[0] + '">' + item[1] + '</button>').join('') + '</div></section>' : '') + '</section>';
    document.querySelector('#password-form').onsubmit = function (event) { event.preventDefault(); const form = new FormData(event.target); if (form.get('new_password') !== form.get('confirm_password')) alert('Las contraseñas no coinciden.'); else alert('La solicitud de cambio está lista para conectarse con Apps Script.'); };
    if (!isAdmin) return;
    document.querySelector('#v36-health').onclick = function () { api('health').then(function (r) { alert(r.message || 'Conexión activa'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#v36-validate').onclick = function () { api('setup').then(function (r) { alert(r.message || 'Estructura validada'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#v36-reconcile').onclick = function () { api('reconcileStock').then(function (r) { alert(r.message || 'Stock sincronizado por grupos.'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#v36-standardize').onclick = async function () { try { const dates = await api('formatDates'); const money = await api('formatMoney'); alert((dates.message || 'Fechas normalizadas.') + ' ' + (money.message || 'Montos normalizados.')); } catch (error) { alert('No se pudo estandarizar: ' + error.message); } };
    document.querySelectorAll('[data-v36-clean]').forEach(button => button.onclick = async function () { const key = button.dataset.v36Clean; const confirmation = prompt('Para continuar escribe exactamente: LIMPIAR ' + key); if (confirmation !== 'LIMPIAR ' + key) return; if (!confirm('¿Confirmas la limpieza de la hoja seleccionada? Esta acción no se puede deshacer.')) return; button.disabled = true; try { const result = await api('clearSheet', { sheetKey: key, confirmation, userId: currentUser.username }); alert(result.message || 'Limpieza completada.'); } catch (error) { alert('No se pudo limpiar la hoja: ' + error.message); } finally { button.disabled = false; } });
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
      const raw = response.data || [], rows = raw.map(function (entry) { let snapshot = {}; try { snapshot = typeof entry.json_despues === 'string' ? JSON.parse(entry.json_despues || '{}') : (entry.json_despues || {}); } catch (_) {} return Object.assign({}, snapshot, entry); });
      const fields = ['fecha','accion','usuario','imei','marca','modelo','n_linea','responsable','dni','cargo','tipo','supervisor','zona','cuenta','departamento','ciudad','canal','tienda','tipo_uso','fecha_asignacion','monto','estado','observaciones'];
      document.querySelector('#app').innerHTML = '<section class="section v36-history"><div class="section-head"><h2>📋 Historial IMEI</h2><button class="btn secondary" id="v36-hrefresh">🔄 Actualizar</button></div><div id="v36-hcards"></div><div class="section-body"><input id="v36-hq" class="input search-field" placeholder="🔍 Buscar IMEI completo o parcial..."></div><div id="v36-hresults"></div></section>';
      const draw = function () { const query = normalize(document.querySelector('#v36-hq').value); const out = query ? rows.filter(row => normalize(row.imei).includes(query)) : []; const first = out[0] || {}; const total = out.reduce((sum, row) => sum + Number(row.monto || row.valor || 0), 0); document.querySelector('#v36-hcards').innerHTML = out.length ? '<div class="cards compact v36-history-cards">' + [['📱 MODELO','modelo'],['👤 RESPONSABLE','responsable'],['📊 ESTADO','estado'],['👤 SUPERVISOR','supervisor'],['📍 ZONA','zona'],['🏢 CUENTA','cuenta'],['📅 FECHA','fecha'],['💰 MONTO TOTAL',null]].map(function (item) { return '<div class="metric"><strong>' + (item[1] ? cardValue(first, item[1]) : cardValue({ monto: total }, 'monto')) + '</strong><span>' + item[0] + '</span></div>'; }).join('') + '</div>' : ''; window.__historyRows = out; document.querySelector('#v36-hresults').innerHTML = query ? (out.length ? table(out, fields) : '<div class="empty">No hay historial para ese IMEI.</div>') : '<div class="empty">Escribe un IMEI para consultar el historial.</div>'; };
      document.querySelector('#v36-hq').oninput = draw; document.querySelector('#v36-hrefresh').onclick = renderHistory; draw();
    } catch (error) { errorView('No se pudo cargar Historial IMEI', error, 'renderHistory'); }
  };

  const baseImport = window.renderImport;
  window.renderImport = renderImport = function () { baseImport(); const head = document.querySelector('#app .section-head'); if (!head) return; head.style.display = 'flex'; head.style.alignItems = 'center'; const description = [...head.children].find(child => child.tagName === 'SPAN'); const refresh = [...head.children].find(child => child.tagName === 'BUTTON'); if (description) { description.style.marginLeft = 'auto'; description.style.order = '2'; } if (refresh) { refresh.style.order = '3'; refresh.style.marginLeft = '0'; } };

  /* Formato único para tablas, tarjetas, historial y fichas de notificaciones. */
  function formatMoney(value) {
    const n = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
    return 'S/ ' + (Number.isFinite(n) ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '0.00');
  }
  function formatDateTime(value) {
    if (value == null || value === '') return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    return dd + '-' + mm + '-' + d.getFullYear() + ' / ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function formatVisibleValue(value, key) {
    const name = String(key || '').toLowerCase();
    if (value == null || value === '') return '';
    if (/(monto|amount|valor|total)/.test(name) && !/(cantidad|registros|equipos)/.test(name)) return formatMoney(value);
    if (/(timestamp|created_at|updated_at|fecha_hora|datetime)/.test(name)) return formatDateTime(value);
    if (/^(fecha|date|fecha_asignacion|fecha_ingreso|fecha_incidente)$/.test(name)) { const parsed = formatDateTime(value); return parsed ? parsed.split(' / ')[0] : String(value); }
    return value;
  }
  window.formatLduMoney = formatMoney;
  window.formatLduDateTime = formatDateTime;
  window.displayImportValue = displayImportValue = formatVisibleValue;
  window.money = money = formatMoney;
  window.amount = amount = formatMoney;

  /* Garantiza que la primera apertura de Vista previa espere al cargador XLSX. */
  const basePreviewImport = window.previewImport;
  if (typeof basePreviewImport === 'function') window.previewImport = previewImport = async function (file, module, card) {
    if (!window.XLSX && typeof window.ensureXlsx === 'function') await window.ensureXlsx();
    if (!window.XLSX) throw new Error('No se pudo cargar el lector XLSX.');
    return basePreviewImport(file, module, card);
  };

  /* Unifica el encabezado de los módulos del Dashboard y conserva sus tarjetas. */
  const baseStateSection = window.stateSection;
  if (typeof baseStateSection === 'function') window.stateSection = stateSection = function (title, rows, group) {
    let html = baseStateSection(title, rows, group);
    if (html.indexOf('📤 Exportar') < 0 && html.indexOf('📄 Excel') < 0) html = html.replace(/(<div class="section-head">[\s\S]*?<h2>[\s\S]*?<\/h2>)/, '$1<div class="dashboard-actions"><button type="button" class="btn secondary" data-export-group="' + safe(group) + '">📤 Exportar</button>');
    return html;
  };

  const baseDashboard = window.renderDashboard;
  if (typeof baseDashboard === 'function') window.renderDashboard = renderDashboard = async function () {
    await baseDashboard();
    document.querySelectorAll('.dashboard-module .section-head').forEach(function (head) {
      head.style.display = 'flex'; head.style.alignItems = 'center'; head.style.justifyContent = 'space-between';
      const actions = head.querySelector('.dashboard-actions, .section-head > div');
      if (actions) { actions.style.display = 'flex'; actions.style.gap = '8px'; actions.querySelectorAll('.btn').forEach(function (button) { button.classList.add('secondary'); }); }
    });
    document.querySelectorAll('[data-export-group]').forEach(function (button) { button.onclick = function () { const group = button.dataset.exportGroup; const rows = (state.devices || []).filter(function (row) { return groupFor(row.modelo) === group; }); exportRows(rows, 'dashboard-' + group.toLowerCase()); }; });
  };

  const baseDevices = window.renderDevices;
  if (typeof baseDevices === 'function') window.renderDevices = renderDevices = async function (group) {
    await baseDevices(group);
    const host = document.querySelector('#app');
    if (!host) return;
    host.querySelectorAll('.module-filters,.v26-search-only,.v26-module-filters').forEach(function (node) { node.classList.add('v37-module-filters'); });
    [...host.querySelectorAll('.section')].find(function (section) { return /Inventario|Modelos Antiguos/.test(section.textContent || '') && section.querySelector('table'); })?.classList.add('v37-module-screen');
  };

  window.renderNotifications = renderNotifications = async function () {
    document.querySelector('#app').innerHTML = '<section class="section v37-notifications"><div class="section-head"><h2>🔔 Notificaciones</h2><button class="btn secondary" id="v37-nrefresh">🔄 Actualizar</button></div><div class="section-body"><div class="toolbar"><input id="v37-nq" class="input search-field" placeholder="🔍 Buscar IMEI, responsable, supervisor o modelo..."><select id="v37-nmodule" class="select"><option value="">Todos los módulos</option><option>Inventario LDU</option><option>Modelos Ant. A</option><option>Modelos Ant. B</option><option>Incidencias</option></select></div><div id="v37-ncards"></div><div id="v37-nresults"><div class="empty">Escribe un término para buscar.</div></div><div id="v37-nselected" class="notification-selected empty">Selecciona un registro para preparar una notificación.</div></div></section><section class="section v37-notification-compose"><div class="section-head"><h3>📤 Redactar y enviar</h3></div><form id="v37-nform" class="device-form"><div class="form-grid"><label class="full-field"><span>Tipo de notificación</span><select class="select" name="tipo"><option>⚠️ Incidencia registrada</option><option>📦 Cambio de stock</option><option>📋 Cambio de responsable</option><option>✍️ Mensaje personalizado</option></select></label><label class="full-field"><span>Destinatarios (1 a 4 correos) *</span><input class="input" name="destinatario" required></label><label><span>CC</span><input class="input" name="cc"></label><label><span>Asunto</span><input class="input" name="asunto" value="Notificación LDU" required></label><label class="full-field"><span>Mensaje</span><textarea class="input" name="mensaje" rows="5" required></textarea></label></div><div id="v37-nmsg"></div><div class="form-actions"><button class="btn" type="submit">📤 Enviar correo</button><button class="btn secondary" type="reset">🗑️ Limpiar</button></div></form></section>';
    let rows = null, selected = null, sequence = 0; const fields = ['modulo','imei','marca','modelo','responsable','dni','supervisor','zona','cuenta','departamento','tienda','monto','estado'];
    api('listNotifications').then(function (response) { const history = response && response.data || []; const target = document.querySelector('#v37-nhistory'); if (target) target.innerHTML = history.length ? table(history, ['fecha','tipo','asunto','destinatario','zona','rol','correo','cc','remitente','estado']) : 'No hay notificaciones enviadas.'; }).catch(function () { const target = document.querySelector('#v37-nhistory'); if (target) target.textContent = 'No se pudo cargar el historial de notificaciones.'; });
    const draw = async function () { const q = normalize(document.querySelector('#v37-nq').value), module = document.querySelector('#v37-nmodule').value, token = ++sequence; if (!q) { document.querySelector('#v37-ncards').innerHTML = ''; document.querySelector('#v37-nresults').innerHTML = '<div class="empty">Escribe un término para buscar.</div>'; return; } document.querySelector('#v37-nresults').innerHTML = '<div class="loading">Buscando...</div>'; try { if (!rows) rows = await loadUnified(); if (token !== sequence) return; const out = rows.filter(function (row) { return (!module || row.modulo === module) && Object.keys(row).some(function (key) { return key.charAt(0) !== '_' && normalize(row[key]).includes(q); }); }); document.querySelector('#v37-ncards').innerHTML = out.length ? '<div class="cards compact v37-notification-cards"><div class="metric"><strong>' + out.length + '</strong><span>📊 REGISTROS ENCONTRADOS</span></div><div class="metric"><strong>' + formatMoney(out.reduce(function (sum, row) { return sum + Number(row.monto || row.valor || 0); }, 0)) + '</strong><span>💰 MONTO TOTAL</span></div><div class="metric"><strong>' + safe(q) + '</strong><span>🔎 CRITERIO</span></div></div>' : ''; document.querySelector('#v37-nresults').innerHTML = out.length ? table(out, fields) : '<div class="empty">Sin coincidencias.</div>'; document.querySelector('#v37-nresults').querySelectorAll('tbody tr').forEach(function (tr, index) { tr.onclick = function () { selected = out[index]; document.querySelector('#v37-nselected').innerHTML = '<div class="table-wrap"><table class="n24-ficha-table"><tbody>' + Object.keys(selected).filter(function (key) { return key.charAt(0) !== '_'; }).map(function (key) { return '<tr><th>' + safe(key.replace(/_/g, ' ')) + '</th><td>' + safe(displayImportValue(selected[key], key)) + '</td></tr>'; }).join('') + '</tbody></table></div>'; document.querySelector('#v37-nform [name="message"]').value = 'Detalle del registro seleccionado:\n\n' + Object.keys(selected).map(function (key) { return key + ': ' + selected[key]; }).join('\n'); }; }); } catch (error) { errorView('No se pudo cargar Notificaciones', error, 'renderNotifications'); } };
    document.querySelector('#v37-nq').oninput = draw; document.querySelector('#v37-nmodule').onchange = draw; document.querySelector('#v37-nrefresh').onclick = renderNotifications; document.querySelector('#v37-nform').onsubmit = async function (event) { event.preventDefault(); const form = new FormData(event.target), recipients = String(form.get('destinatario') || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean), msg = document.querySelector('#v37-nmsg'); if (recipients.length < 1 || recipients.length > 4) { msg.textContent = 'Ingresa entre 1 y 4 destinatarios.'; return; } msg.textContent = 'Enviando...'; const result = await api('sendNotification', { notification: { tipo: form.get('tipo'), asunto: form.get('asunto'), destinatario: recipients.join(','), cc: form.get('cc'), mensaje: form.get('mensaje'), imeis: selected ? [selected.imei] : [] }, userId: 'web-user' }); msg.textContent = result && result.status === 'ok' ? '✅ Notificación enviada y registrada.' : (result && result.message || 'No se pudo enviar.'); };
  };

  const stablePreview = window.previewImport;
  if (typeof stablePreview === 'function') window.previewImport = previewImport = async function (file, module, card) {
    if (!window.XLSX && typeof window.ensureXlsx === 'function') await window.ensureXlsx();
    const msg = card && card.querySelector('[data-message]');
    try { const book = XLSX.read(await file.arrayBuffer(), { type: 'array' }), raw = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' }), rows = canonicalizeImportRows(raw, module); if (!rows.length) throw Error('El archivo no contiene registros.'); const drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.innerHTML = '<aside class="drawer-card import-preview-card"><div class="section-head"><h2>📋 Vista previa — ' + safe(file.name) + '</h2><button class="btn secondary" data-v37-close>✕</button></div><p>Registros detectados: <strong>' + rows.length + '</strong></p>' + table(rows.slice(0, 10), Object.keys(rows[0])) + '<progress data-v37-progress max="100" value="0" style="width:100%"></progress><div data-v37-progress-text>Listo para importar.</div><div data-v37-result></div><div class="form-actions"><button class="btn secondary" data-v37-cancel>Cancelar</button><button class="btn" data-v37-confirm>📥 Importar</button></div></aside>'; document.body.appendChild(drawer); const close = function () { drawer.remove(); }; drawer.querySelector('[data-v37-close]').onclick = close; drawer.querySelector('[data-v37-cancel]').onclick = close;
      drawer.querySelector('[data-v37-confirm]').onclick = async function () { const button = this, progress = drawer.querySelector('[data-v37-progress]'), status = drawer.querySelector('[data-v37-progress-text]'), result = drawer.querySelector('[data-v37-result]'), rejected = []; let nuevos = 0, actualizados = 0, errores = 0; button.disabled = true; for (let start = 0, batchNo = 1; start < rows.length; start += 50, batchNo++) { const batch = rows.slice(start, start + 50), ids = batch.map(function (row) { return row.imei || row.imei_original || 'IMEI no identificado'; }); status.textContent = 'Procesando lote ' + batchNo + ' · ' + Math.min(start + batch.length, rows.length) + ' de ' + rows.length + ' registros'; try { const response = await api('importRows', { module, rows: batch, userId: 'importacion' }), data = response && response.data || {}, details = data.rejectedRows || []; nuevos += Number(data.imported || data.inserted || data.nuevos || 0); actualizados += Number(data.updated || data.actualizados || 0); if (details.length) details.forEach(function (item) { rejected.push({ imei: item.imei || item.IMEI || item.imei_original || 'IMEI no identificado', reason: item.reason || item.motivo || item.message || 'Motivo no informado' }); }); if (response.status !== 'ok' && !details.length) errores += ids.length; errores += Number(data.errorCount || data.errorsCount || 0); } catch (error) { ids.forEach(function (imei) { rejected.push({ imei: imei, reason: error.message || 'Error de comunicación' }); }); errores += batch.length; } progress.value = Math.round(Math.min(start + batch.length, rows.length) * 100 / rows.length); result.textContent = 'Procesados: ' + Math.min(start + batch.length, rows.length) + ' · Nuevos: ' + nuevos + ' · Actualizados: ' + actualizados + ' · Rechazados: ' + rejected.length + ' · Errores: ' + errores; } progress.value = 100; status.textContent = '✅ Finalizado'; result.innerHTML = '<strong>Resumen:</strong> Procesados: ' + rows.length + ' · Nuevos: ' + nuevos + ' · Actualizados: ' + actualizados + ' · Rechazados: ' + rejected.length + ' · Errores: ' + errores + (rejected.length ? '<div class="v37-rejected-list"><strong>IMEI rechazados:</strong><ul>' + rejected.map(function (item) { return '<li>' + safe(item.imei) + ' — ' + safe(item.reason) + '</li>'; }).join('') + '</ul></div>' : ''); button.disabled = false; };
    } catch (error) { if (msg) msg.textContent = 'Error: ' + error.message; else throw error; }
  };

  const dashboardWithRules = window.renderDashboard;
  if (typeof dashboardWithRules === 'function') window.renderDashboard = renderDashboard = async function () { await dashboardWithRules(); const incidentHead = document.querySelector('.dashboard-incidents .section-head'); if (incidentHead) { [...incidentHead.querySelectorAll('button')].filter(function (b) { return /Ver todo/i.test(b.textContent); }).forEach(function (b) { b.remove(); }); let actions = incidentHead.querySelector('.v37-dashboard-actions'); if (!actions) { actions = document.createElement('div'); actions.className = 'v37-dashboard-actions'; incidentHead.appendChild(actions); } if (!actions.querySelector('[data-v37-inc-export]')) { const b = document.createElement('button'); b.className = 'btn secondary'; b.textContent = '📤 Exportar'; b.dataset.v37IncExport = '1'; b.onclick = function () { exportRows(state.incidents || [], 'incidencias-dashboard'); }; actions.appendChild(b); } if (!actions.querySelector('[data-v37-inc-module]')) { const b = document.createElement('button'); b.className = 'btn secondary'; b.textContent = '📋 Ver módulo'; b.dataset.v37IncModule = '1'; b.onclick = function () { navigate('incidents'); }; actions.appendChild(b); } } document.querySelectorAll('.stock-summary .stock-group table').forEach(function (node) { const heads = [...node.querySelectorAll('thead th')].map(function (x) { return normalize(x.textContent); }), si = heads.indexOf('STOCK'), ri = heads.findIndex(function (x) { return x.includes('EN INV') || x.includes('REGISTR') || x.includes('SISTEMA'); }); if (si < 0 || ri < 0) return; node.querySelectorAll('tbody tr').forEach(function (row) { const cells = row.querySelectorAll('td'), stock = Number(String(cells[si].textContent).replace(/[^0-9.-]/g, '')), registered = Number(String(cells[ri].textContent).replace(/[^0-9.-]/g, '')), difference = registered - stock, target = cells[cells.length - 1]; if (!target) return; if (difference === 0) target.textContent = '✅'; else if (difference > 0) target.textContent = difference + '+'; else target.textContent = String(Math.abs(difference)); target.classList.toggle('v37-surplus', difference > 0); target.classList.toggle('v37-missing', difference < 0); target.classList.toggle('v37-complete', difference === 0); }); }); };

  const baseSearch = window.renderSearch;
  if (typeof baseSearch === 'function') window.renderSearch = renderSearch = async function () { await baseSearch(); const host = document.querySelector('#v36-results'); if (!host) return; const addActions = function () { const tableNode = host.querySelector('table'); if (!tableNode || tableNode.querySelector('[data-v37-actions-head]')) return; const head = tableNode.querySelector('thead tr'); if (!head) return; const th = document.createElement('th'); th.textContent = 'ACCIONES'; th.dataset.v37ActionsHead = '1'; head.appendChild(th); const rows = window.__searchRows || []; tableNode.querySelectorAll('tbody tr').forEach(function (tr, index) { const cell = document.createElement('td'); cell.className = 'row-actions'; const row = rows[index]; cell.innerHTML = '<button type="button" class="btn secondary" data-v37-search-view>👁️</button><button type="button" class="btn secondary" data-v37-search-history>📋</button><button type="button" class="btn secondary" data-v37-search-edit>✏️</button>'; tr.appendChild(cell); cell.querySelector('[data-v37-search-view]').onclick = function () { showDetail(row); }; cell.querySelector('[data-v37-search-history]').onclick = function () { state.historyImei = row.imei || row.imei_original; navigate('history'); }; cell.querySelector('[data-v37-search-edit]').onclick = function () { if ((row.id_incidencia || row.incident_id) && typeof openIncidentForm === 'function') openIncidentForm(row); else if (typeof openDeviceForm === 'function') openDeviceForm(row); }; }); }; addActions(); const observer = new MutationObserver(addActions); observer.observe(host, { childList: true, subtree: true }); };

  const baseStock = window.renderStock;
  if (typeof baseStock === 'function') window.renderStock = renderStock = async function () { await baseStock(); const unique = new Set((state.devices || []).map(function (row) { return imei(row); }).filter(Boolean)); const stock = new Set((state.stock || []).map(function (row) { return imei(row); }).filter(Boolean)); const noVivo = [...unique].filter(function (id) { return !stock.has(id); }).length; document.querySelectorAll('.metric').forEach(function (metric) { if (/IMEI NO VIVO/i.test(metric.textContent || '')) { const value = metric.querySelector('strong'); if (value) value.textContent = noVivo; } }); };

  async function validateImeiForm(form, fieldName) { const input = form && form.querySelector('[name="' + fieldName + '"]'); if (!input) return true; const raw = String(input.value || '').replace(/\D/g, ''); if (!raw) return true; const note = form.querySelector('[data-v38-imei-note]') || Object.assign(document.createElement('div'), { dataset: { v38ImeiNote: '1' }, className: 'form-note' }); if (!note.parentNode) input.closest('label')?.after(note); const result = await api('lookupImei', { imei: raw }), data = result && result.data || {}, found = data.device || data.stock, submit = form.querySelector('button[type="submit"]'); if (!found) { form.dataset.imeiDuplicate = '0'; if (submit) submit.disabled = false; note.textContent = '✅ IMEI disponible para registrar.'; return true; } const group = found.grupo || (typeof groupFor === 'function' ? groupFor(found.modelo) : '—'), moduleName = found.modulo || found.hoja_origen || found.source_sheet || (data.device ? 'Inventario LDU' : 'Stock'), fields = { marca: found.marca, modelo: found.modelo, n_linea: found.n_linea, responsable: found.responsable || found.nombre, dni: found.dni, cargo: found.cargo, tipo: found.tipo, supervisor: found.supervisor, zona: found.zona, cuenta: found.cuenta, departamento: found.departamento, ciudad: found.ciudad, canal: found.canal, tienda: found.tienda, tipo_uso: found.tipo_uso, monto: found.monto || found.valor, valor: found.monto || found.valor, estado: found.estado, estado_proceso: found.estado_proceso, fecha_asignacion: found.fecha_asignacion, fecha_incidente: found.fecha_incidente }; Object.keys(fields).forEach(function (key) { const control = form.querySelector('[name="' + key + '"]'); if (control && fields[key] != null && fields[key] !== '') { if (control.tagName === 'SELECT' && ![...control.options].some(function (option) { return String(option.value) === String(fields[key]); })) { const option = document.createElement('option'); option.value = fields[key]; option.textContent = fields[key]; control.appendChild(option); } control.value = fields[key]; } }); form.dataset.imeiDuplicate = '1'; if (submit) submit.disabled = true; note.textContent = '⚠️ IMEI ya registrado. Se cargó la información disponible y no se permite crear un duplicado.'; alert('⚠️ IMEI ya se encuentra registrado\n\n📱 IMEI: ' + raw + '\n📦 Grupo: ' + group + '\n📱 Modelo: ' + (found.modelo || '—') + '\n💰 Monto: ' + formatMoney(found.monto || found.valor || 0) + '\n📊 Estado: ' + (found.estado || found.estado_proceso || '—') + '\n📦 Módulo: ' + moduleName); return false; }
  const baseDeviceForm = window.openDeviceForm;
  if (typeof baseDeviceForm === 'function') window.openDeviceForm = openDeviceForm = function (existing) { baseDeviceForm(existing); if (existing && existing.imei) return; const form = document.querySelector('#device-form'); if (!form) return; const input = form.querySelector('[name="imei"]'); input.addEventListener('blur', function () { validateImeiForm(form, 'imei'); }); const originalSubmit = form.onsubmit; form.onsubmit = function (event) { if (form.dataset.imeiDuplicate === '1') { event.preventDefault(); alert('⚠️ No se puede registrar un IMEI duplicado.'); return; } return originalSubmit ? originalSubmit.call(this, event) : undefined; }; };
  const baseIncidentForm = window.openIncidentForm;
  if (typeof baseIncidentForm === 'function') window.openIncidentForm = openIncidentForm = function (existing) { baseIncidentForm(existing); if (existing && (existing.id_incidencia || existing.incident_id || existing.id)) return; const form = document.querySelector('#incident-form'); if (!form) return; const input = form.querySelector('[name="imei_original"]'); input.addEventListener('blur', function () { validateImeiForm(form, 'imei_original'); }); const originalSubmit = form.onsubmit; form.onsubmit = function (event) { if (form.dataset.imeiDuplicate === '1') { event.preventDefault(); alert('⚠️ No se puede registrar una incidencia con un IMEI ya registrado.'); return; } return originalSubmit ? originalSubmit.call(this, event) : undefined; }; };
  const baseHistory = window.renderHistory;
  if (typeof baseHistory === 'function') window.renderHistory = renderHistory = async function () { await baseHistory(); const updateAmount = function () { const rows = window.__historyRows || [], record = rows.find(function (row) { return (row.monto != null && row.monto !== '') || (row.valor != null && row.valor !== ''); }), metric = [...document.querySelectorAll('#v36-hcards .metric')].find(function (node) { return /MONTO TOTAL/i.test(node.textContent || ''); }); if (metric && record) metric.querySelector('strong').textContent = formatMoney(record.monto || record.valor); }; const input = document.querySelector('#v36-hq'); if (input) input.addEventListener('input', function () { setTimeout(updateAmount, 0); }); setTimeout(updateAmount, 0); };

  const installNotificationPreview = function () { const form = document.querySelector('#v37-nform'), actions = form && form.querySelector('.form-actions'); if (!actions || actions.querySelector('[data-v37-mail-preview]')) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'btn secondary'; button.dataset.v37MailPreview = '1'; button.textContent = '👁️ Vista previa'; actions.insertBefore(button, actions.firstChild); button.onclick = function () { const data = new FormData(form), drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.innerHTML = '<aside class="drawer-card v37-mail-preview"><div class="section-head"><h2>👁️ Vista previa del correo</h2><button class="btn secondary" data-v37-mail-close>✕</button></div><div class="form-note"><b>Tipo:</b> ' + safe(data.get('tipo')) + '<br><b>Para:</b> ' + safe(data.get('destinatario')) + '<br><b>Asunto:</b> ' + safe(data.get('asunto')) + '</div><div class="v37-mail-body">' + safe(data.get('mensaje')).replace(/\n/g, '<br>') + '</div></aside>'; document.body.appendChild(drawer); drawer.querySelector('[data-v37-mail-close]').onclick = function () { drawer.remove(); }; }; };
  const autoSelectNotification = function () { document.querySelectorAll('#v37-nresults table tbody').forEach(function (tbody) { const host = tbody.closest('#v37-nresults'); if (!host || host.dataset.v37AutoSelected === '1' || !tbody.querySelector('tr')) return; host.dataset.v37AutoSelected = '1'; tbody.querySelector('tr').click(); }); };
  /* v38: installStockTotals quedó deshabilitada — matcheaba CUALQUIER <section> cuyo texto
   * contuviera "RESUMEN DE STOCK POR MODELO" (incluido #app completo, que envuelve TODO el
   * Dashboard), así que le agregaba una fila TOTAL a TODAS las tablas de la página (incluidas
   * "Últimos dispositivos" / "Incidencias recientes", donde no correspondía) y además borraba
   * la fila TOTAL ya construida y bien estilizada (clase total-row, ver components.css) que
   * arma stockSummary(), reemplazándola por un tfoot sin ese estilo. stockSummary() ya entrega
   * su propia fila TOTAL correctamente clasificada; no hace falta reconstruirla aquí. */
  const installStockTotals = function () {};
  const v37DataObserver = new MutationObserver(function () { v37DataObserver.disconnect(); autoSelectNotification(); installStockTotals(); v37DataObserver.observe(document.querySelector('#app'), { childList: true, subtree: true }); }); v37DataObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
  const notificationHistoryColumns = [['timestamp', '📅 FECHA'], ['type', '🔔 TIPO'], ['subject', '📄 ASUNTO'], ['recipient', '👤 DESTINATARIO'], ['zona', '📍 ZONA'], ['role', '💼 ROL'], ['email', '📧 CORREO'], ['cc', '📨 CC'], ['sender', '✉️ REMITENTE'], ['status', '✅ ESTADO']];
  const notificationAliases = { timestamp: ['timestamp', 'fecha'], type: ['type', 'tipo'], subject: ['subject', 'asunto'], recipient: ['recipient', 'destinatario'], zona: ['zona'], role: ['role', 'rol'], email: ['email', 'correo'], cc: ['cc'], sender: ['sender', 'remitente'], status: ['status', 'estado'] };
  const renderNotificationHistory = function (target, rows) { rows = Array.isArray(rows) ? rows : []; target.innerHTML = rows.length ? '<div class="table-wrap v37-notification-history-table"><table><thead><tr>' + notificationHistoryColumns.map(function (col) { return '<th>' + col[1] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (row) { return '<tr>' + notificationHistoryColumns.map(function (col) { const aliases = notificationAliases[col[0]] || [col[0]], value = aliases.reduce(function (found, key) { return found !== '' && found != null ? found : (row[key] == null ? '' : row[key]); }, ''); return '<td>' + safe(displayImportValue(value, col[0])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No hay notificaciones enviadas.</div>'; };
  const loadNotificationHistory = async function () { const target = document.querySelector('#v37-nhistory'); if (!target) return; const button = document.querySelector('#v37-nhistory-refresh'); if (button) button.disabled = true; target.innerHTML = '<div class="loading">Cargando historial de notificaciones...</div>'; try { const response = await api('listNotifications'); renderNotificationHistory(target, response && response.data || []); } catch (error) { target.innerHTML = '<div class="empty error">No se pudo cargar el historial de notificaciones: ' + safe(error.message) + '</div>'; } finally { if (button) button.disabled = false; } };
  const installNotificationHistory = function () { const app = document.querySelector('#app'); if (!app || !document.querySelector('.v37-notifications') || document.querySelector('#v37-notification-history')) return; const section = document.createElement('section'); section.className = 'section v37-notification-history'; section.id = 'v37-notification-history'; section.innerHTML = '<div class="section-head"><h2>📋 Historial de Notificaciones Enviadas</h2><button type="button" class="btn secondary" id="v37-nhistory-refresh">🔄 Actualizar</button></div><div class="section-body"><div id="v37-nhistory"></div></div>'; app.appendChild(section); document.querySelector('#v37-nhistory-refresh').onclick = loadNotificationHistory; loadNotificationHistory(); };
  const appObserver = new MutationObserver(function () { installNotificationPreview(); installNotificationHistory(); }); appObserver.observe(document.querySelector('#app'), { childList: true, subtree: true }); installNotificationPreview(); installNotificationHistory();
})();
