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
      const fields = ['modulo', 'imei', 'marca', 'modelo', 'n_linea', 'responsable', 'dni', 'cargo', 'tipo', 'supervisor', 'zona', 'cuenta', 'departamento', 'city', 'tienda', 'fecha_asignacion', 'monto', 'estado'];
      const cardFields = [['📱 IMEI', 'imei'], ['📱 MODELO', 'modelo'], ['📦 MÓDULO', 'modulo'], ['📊 ESTADO', 'estado'], ['📦 INVENTARIO', 'en_inventario'], ['👤 RESPONSABLE', 'responsable'], ['🪪 DNI', 'dni'], ['👤 SUPERVISOR', 'supervisor'], ['📍 ZONA', 'zona'], ['🏢 CUENTA', 'cuenta'], ['🗺️ DEPARTAMENTO', 'departamento'], ['🏙️ CIUDAD', 'city'], ['🏪 TIENDA', 'tienda'], ['📅 FECHA ASIGNACIÓN', 'fecha_asignacion'], ['💰 MONTO S/', 'monto']];
      document.querySelector('#app').innerHTML = '<section class="section v36-search"><div class="section-head"><h2>🔎 Buscador</h2><button class="btn secondary" id="v36-refresh">🔄 Actualizar</button></div><div class="section-body"><div class="toolbar"><input id="v36-q" class="input search-field" placeholder="🔍 Buscar IMEI, DNI, nombre, modelo..."><select id="v36-module" class="select"><option value="">Todos los módulos</option><option>Inventario LDU</option><option>Modelos Ant. A</option><option>Modelos Ant. B</option><option>Stock</option><option>Incidencias</option></select></div></div><div id="v36-cards"><div class="empty">Escribe un término para buscar.</div></div><div id="v36-results"><div class="empty">Escribe un término para buscar.</div></div></section>';
      let sequence = 0;
      const draw = function () {
        const current = ++sequence, query = normalize(document.querySelector('#v36-q').value), module = document.querySelector('#v36-module').value;
        const out = query ? rows.filter(function (row) { return (!module || row.modulo === module) && Object.keys(row).some(function (key) { return key.charAt(0) !== '_' && normalize(row[key]).indexOf(query) >= 0; }); }) : [];
        window.__searchRows = out;
        if (current !== sequence) return;
        document.querySelector('#v36-results').innerHTML = query ? (out.length ? table(out, fields) : '<div class="empty">Sin resultados.</div>') : '<div class="empty">Escribe un término para buscar.</div>';
        document.querySelector('#v36-cards').innerHTML = out.length ? '<div class="cards compact v36-card-grid">' + cardFields.map(function (field) { return '<div class="metric"><strong>' + cardValue(out[0], field[1]) + '</strong><span>' + field[0] + '</span></div>'; }).join('') + '</div>' : '<div class="empty">Escribe un término para buscar.</div>';
      };
      document.querySelector('#v36-q').oninput = draw;
      document.querySelector('#v36-module').onchange = draw;
      document.querySelector('#v36-refresh').onclick = renderSearch;
      draw();
    } catch (error) { errorView('No se pudo cargar Buscador', error, 'renderSearch'); }
  };

  const previousUsers = window.renderUsers;
  window.renderUsers = renderUsers = async function () {
    document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>👥 Usuarios</h2><div class="toolbar"><button class="btn secondary" id="v36-users-refresh">🔄 Actualizar</button><button class="btn" id="v36-new-user">＋ Nuevo Usuario</button></div></div><div id="users-results"><div class="loading">Cargando usuarios...</div></div></section>';
    document.querySelector('#v36-users-refresh').onclick = renderUsers;
    document.querySelector('#v36-new-user').onclick = openUserForm;
    try {
      const result = await api('listUsers');
      document.querySelector('#users-results').innerHTML = table(result.data || [], ['user_id', 'username', 'name', 'role', 'email', 'active', 'actions']);
    } catch (error) { errorView('No se pudo cargar Usuarios', error, 'renderUsers'); }
  };

  /* Configuración no expone limpieza ni borrado. Esas operaciones quedan
   * disponibles únicamente desde endpoints específicos por hoja, cuando se implementen. */
  window.renderSettings = renderSettings = function () {
    document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>⚙️ Configuración</h2></div><div class="settings-grid"><article class="section"><h3>🔐 Seguridad</h3><form id="password-form" class="device-form">' + field('Contraseña actual', 'current_password', 'password', '', 'required') + field('Nueva contraseña', 'new_password', 'password', '', 'required minlength="4"') + field('Confirmar contraseña', 'confirm_password', 'password', '', 'required minlength="4"') + '<button class="btn">🔐 Cambiar contraseña</button></form></article><article class="section"><h3>🛠️ Mantenimiento seguro</h3><div class="toolbar"><button class="btn" id="v36-health">🔌 Probar conexión</button><button class="btn secondary" id="v36-validate">📋 Validar estructura</button></div><p class="muted">Las funciones destructivas de limpieza se habilitarán únicamente cuando exista un endpoint seguro y específico para cada hoja.</p></article></div></section>';
    document.querySelector('#v36-health').onclick = function () { api('health').then(function (r) { alert(r.message || 'Conexión activa'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#v36-validate').onclick = function () { api('setup').then(function (r) { alert(r.message || 'Estructura validada'); }).catch(function (e) { alert(e.message); }); };
    document.querySelector('#password-form').onsubmit = function (event) { event.preventDefault(); const form = new FormData(event.target); if (form.get('new_password') !== form.get('confirm_password')) alert('Las contraseñas no coinciden.'); else alert('La solicitud de cambio está lista para conectarse con Apps Script.'); };
  };
})();
