(function () {
  var N33 = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var E33 = function (v) { return typeof safe === 'function' ? safe(v) : String(v == null ? '' : v); };
  var I33 = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };

  /* Presentación transversal: fechas, campos de importación, usuario y pie. */
  var oldDisplay33 = typeof displayImportValue === 'function' ? displayImportValue : null;
  function date33(value, withTime) {
    if (value == null || value === '') return '';
    var raw = String(value).trim(), m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m && !withTime) return m[3] + '-' + m[2] + '-' + m[1];
    var d = new Date(value); if (isNaN(d.getTime())) return raw;
    var out = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
    return withTime ? out + ' / ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : out;
  }
  function display33(value, key) {
    var k = String(key || '').toLowerCase();
    if (k === 'device_id') { var digits = I33(value); return digits ? digits.slice(-4).padStart(4, '0') : String(value || '').slice(-4); }
    if (k === 'created_byimportacion' || k === 'updated_byimportacion') return String(value == null ? '' : value).toUpperCase();
    if (k === 'fecha_asignacion' || k === 'fecha_ingreso' || k === 'fecha_incidente' || k === 'fecha') return date33(value, false);
    if (k === 'created_at' || k === 'updated_at' || k === 'timestamp') return date33(value, true);
    return oldDisplay33 && oldDisplay33 !== display33 ? oldDisplay33(value, key) : value;
  }
  window.displayImportValue = displayImportValue = display33;
  window.formatLduDate = function (v) { return date33(v, false); };
  window.formatLduDateTime = function (v) { return date33(v, true); };

  /* Validación preventiva para altas desde la interfaz. El backend sigue siendo
     la autoridad final y debe conservar esta regla en su router de escritura. */
  var apiBase33 = api;
  api = async function (action, payload) {
    if (action === 'createDevice' && payload && payload.device && I33(payload.device.imei)) {
      var devices = await apiBase33('listDevices');
      if ((devices.data || []).some(function (x) { return I33(x.imei) === I33(payload.device.imei); })) return { status: 'error', message: 'El IMEI ya está registrado. Usa Editar para actualizarlo.' };
    }
    if (action === 'createIncident' && payload && payload.incident && I33(payload.incident.imei_original)) {
      var incidents = await apiBase33('listIncidents');
      if ((incidents.data || []).some(function (x) { return I33(x.imei_original || x.imei) === I33(payload.incident.imei_original); })) return { status: 'error', message: 'Ya existe una incidencia para este IMEI.' };
    }
    return apiBase33(action, payload);
  };

  function ensureChrome33() {
    var top = document.querySelector('.global-actions');
    if (top && !top.querySelector('#ldu-user-chip')) {
      var chip = document.createElement('span'); chip.id = 'ldu-user-chip'; chip.className = 'user-chip';
      chip.textContent = '👤 ' + (window.LDU_USER_NAME || localStorage.getItem('ldu_user_name') || 'Administrador'); top.insertBefore(chip, top.firstChild);
    }
    var shell = document.querySelector('.app-shell');
    if (shell && !shell.querySelector('#ldu-footer')) { var footer = document.createElement('footer'); footer.id = 'ldu-footer'; footer.textContent = '© Andy Sanchez. Todos los derechos reservados. Sistema desarrollado para la gestión y control de información.'; shell.appendChild(footer); }
  }
  ensureChrome33();
  new MutationObserver(ensureChrome33).observe(document.body, { childList: true, subtree: true });

  /* Notificaciones: búsqueda, módulo, ficha seleccionada, mensaje predeterminado y vista previa. */
  window.renderNotifications = async function () {
    loading('Cargando notificaciones...');
    try {
      var all = await loadUnified(), result = await api('listNotifications'), selected = null;
      var modules = Array.from(new Set(all.map(function (x) { return x.modulo; }).filter(Boolean)));
      document.querySelector('#app').innerHTML = '<section class="section notifications-v33"><div class="section-head"><h2>🔔 Notificaciones</h2><button class="btn secondary" id="n33-refresh">🔄 Actualizar</button></div><div class="notification-picker"><h3>📱 Seleccionar dispositivo(s) a notificar</h3><div class="toolbar"><input id="n33-q" class="input" placeholder="Buscar por IMEI, responsable, supervisor o modelo..."><select id="n33-module" class="select"><option value="">Todos los módulos</option>' + modules.map(function (m) { return '<option>' + E33(m) + '</option>'; }).join('') + '</select></div><div id="n33-results" class="notification-results"></div><div id="n33-selected" class="notification-selected empty">Selecciona un IMEI para cargar su ficha.</div></div><section class="section notification-compose"><div class="section-head"><h3>📤 Redactar y enviar</h3><button class="btn secondary" type="button" id="n33-preview">👁️ Vista previa</button></div><form id="n33-form" class="device-form"><div class="form-grid"><label class="full-field"><span>Tipo de notificación</span><select class="select" name="type" id="n33-type"><option>⚠️ Incidencia registrada</option><option>📦 Cambio de stock</option><option>📋 Cambio de responsable</option><option>✍️ Mensaje personalizado</option></select></label><label class="full-field"><span>Destinatarios (1 a 4 correos) *</span><input class="input" name="recipient" required placeholder="correo1@dominio.com, correo2@dominio.com"></label><label><span>CC</span><input class="input" name="cc" placeholder="correo@dominio.com"></label><label><span>Asunto</span><input class="input" name="subject" value="Incidencia registrada" required></label><label class="full-field"><span>Mensaje</span><textarea class="input" name="message" id="n33-message" rows="7" required></textarea></label></div><div id="n33-msg"></div><div class="form-actions"><button class="btn" type="submit">📤 Enviar correo</button><button class="btn secondary" type="reset">🗑️ Limpiar</button></div></form></section></section><section class="section"><div class="section-head"><h2>📋 Historial de Notificaciones Enviadas</h2><button class="btn secondary" id="n33-history-refresh">🔄 Actualizar</button></div><div id="n33-history"></div></section>';
      var draw = function () { var q = N33(document.querySelector('#n33-q').value), mod = document.querySelector('#n33-module').value, out = all.filter(function (x) { return (!q || Object.values(x).some(function (v) { return N33(v).includes(q); })) && (!mod || x.modulo === mod); }); document.querySelector('#n33-results').innerHTML = out.slice(0, 50).map(function (x, i) { return '<button type="button" class="n33-imei" data-index="' + i + '"><b>' + E33(x.imei) + '</b><span>' + E33(x.modulo) + ' · ' + E33(x.modelo || x.responsable) + '</span></button>'; }).join('') || '<div class="empty">Sin coincidencias</div>'; document.querySelectorAll('.n33-imei').forEach(function (b) { b.onclick = function () { selected = out[Number(b.dataset.index)]; document.querySelectorAll('.n33-imei').forEach(function (x) { x.classList.toggle('selected', x === b); }); document.querySelector('#n33-selected').innerHTML = '<strong>📍 Módulo: ' + E33(selected.modulo) + '</strong><div class="n33-imei-box">' + Object.keys(selected).filter(function (k) { return k !== 'modulo'; }).map(function (k) { return '<div><b>' + E33(k.replace(/_/g, ' ')) + '</b><span>' + E33(display33(selected[k], k)) + '</span></div>'; }).join('') + '</div>'; applyDefault33(); }; }); };
      function applyDefault33() { var type = document.querySelector('#n33-type').value, msg = document.querySelector('#n33-message'); if (type.includes('personalizado')) return; if (!selected) { msg.value = type.includes('Incidencia') ? 'Se ha registrado una incidencia. A continuación el detalle del equipo para su conocimiento.' : 'Se ha registrado un cambio en la información del equipo seleccionado.'; return; } msg.value = (type.includes('Incidencia') ? 'Se ha registrado una incidencia en el dispositivo IMEI ' : 'Se ha registrado un cambio para el dispositivo IMEI ') + (selected.imei || '') + '. Módulo: ' + (selected.modulo || '') + '.\n\n' + Object.keys(selected).filter(function (k) { return k !== 'modulo'; }).map(function (k) { return k + ': ' + display33(selected[k], k); }).join('\n'); }
      function preview33() { var f = new FormData(document.querySelector('#n33-form')), modal = document.createElement('div'); modal.className = 'drawer'; modal.innerHTML = '<aside class="drawer-card n33-preview"><div class="section-head"><h2>👁️ Vista previa del correo</h2><button class="btn secondary" id="n33-close">✕</button></div><div class="n33-mail"><header>⚠️ <b>Sistema de Gestión LDU</b><small>' + E33(f.get('type')) + '</small></header><main><p><b>Para:</b> ' + E33(f.get('recipient')) + '</p><p><b>Asunto:</b> ' + E33(f.get('subject')) + '</p><div class="n33-message">' + E33(f.get('message')).replace(/\n/g, '<br>') + '</div></main><footer>Este correo fue generado por el Sistema de Gestión LDU.</footer></div></aside>'; document.body.appendChild(modal); modal.querySelector('#n33-close').onclick = function () { modal.remove(); }; }
      draw(); document.querySelector('#n33-q').oninput = draw; document.querySelector('#n33-module').onchange = draw; document.querySelector('#n33-type').onchange = applyDefault33; document.querySelector('#n33-preview').onclick = preview33; document.querySelector('#n33-refresh').onclick = renderNotifications; document.querySelector('#n33-history-refresh').onclick = renderNotifications; applyDefault33();
      document.querySelector('#n33-form').onsubmit = async function (e) { e.preventDefault(); var f = new FormData(e.target), recipients = String(f.get('recipient') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean), msg = document.querySelector('#n33-msg'); if (recipients.length < 1 || recipients.length > 4) return alert('Ingresa entre 1 y 4 destinatarios.'); msg.textContent = 'Enviando...'; var response = await api('sendNotification', { notification: { type: f.get('type'), subject: f.get('subject'), recipient: recipients.join(','), recipients: recipients, cc: f.get('cc'), message: f.get('message'), imeis: selected ? [selected.imei] : [] }, userId: 'web-user' }); msg.textContent = response.status === 'ok' ? 'Notificación enviada y registrada.' : (response.message || 'No se pudo enviar.'); };
      document.querySelector('#n33-history').innerHTML = table(result.data || [], ['timestamp', 'type', 'subject', 'recipient', 'zona', 'role', 'email', 'cc', 'sender', 'status']);
    } catch (e) { errorView('No se pudo cargar Notificaciones', e, 'renderNotifications'); }
  };

  /* Autocompletado visible y prevención temprana de duplicados en formularios nuevos. */
  var oldOpenIncident33 = window.openIncidentForm, oldOpenDevice33 = window.openDeviceForm;
  window.openIncidentForm = function (row) { oldOpenIncident33(row); var form = document.querySelector('#incident-form'); if (!form) return; var input = form.querySelector('[name="imei_original"]'), note = document.createElement('div'); note.className = 'v33-lookup-note'; input.parentNode.parentNode.insertBefore(note, input.parentNode.parentNode.firstChild); input.addEventListener('blur', async function () { var r = await api('lookupImei', { imei: input.value }); var d = r.data && (r.data.device || r.data.stock); note.textContent = d ? '✅ IMEI identificado. Se cargó la información disponible; completa solo los campos faltantes.' : 'ℹ️ IMEI no encontrado; puedes registrar una incidencia nueva.'; }); };
  window.openDeviceForm = function (row) { oldOpenDevice33(row); var form = document.querySelector('#device-form'); if (!form || row) return; var input = form.querySelector('[name="imei"]'), note = document.createElement('div'); note.className = 'v33-lookup-note'; input.parentNode.parentNode.insertBefore(note, input.parentNode.parentNode.firstChild); input.addEventListener('blur', async function () { var r = await api('lookupImei', { imei: input.value }); var d = r.data && (r.data.device || r.data.stock); if (d) note.textContent = '⚠️ IMEI ya existe en ' + (d.modulo || 'el sistema') + '. Usa Editar o Importar para actualizarlo; no se creará un duplicado.'; else note.textContent = '✅ IMEI disponible para registrar.'; }); };

  var css33 = document.createElement('style'); css33.textContent = '#ldu-footer{width:100%;box-sizing:border-box;padding:12px 18px;text-align:center;color:#657694;font-size:11px;background:#f4f7fc;border-top:1px solid #d7e2f1}.user-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#eaf2ff;color:#173b7a;font-size:12px;font-weight:700}.notification-picker,.notification-compose{margin:0 0 12px}.notification-picker{padding:14px 18px;border:1px solid #d6e1f4;border-radius:12px;background:#fff}.notification-picker h3{margin:0 0 12px}.notification-results{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;max-height:220px;overflow:auto;margin-top:10px}.n33-imei{border:1px solid #d6e1f4;border-radius:9px;background:#fff;text-align:left;padding:9px 11px;cursor:pointer}.n33-imei:hover,.n33-imei.selected{border-color:#2563eb;background:#eef4ff}.n33-imei span{display:block;color:#526788;font-size:11px;margin-top:3px}.notification-selected{margin-top:10px;padding:10px;border:1px solid #bdd3ef;border-radius:9px;background:#f8fbff}.n33-imei-box{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px;margin-top:8px}.n33-imei-box div{display:flex;justify-content:space-between;gap:8px;font-size:11px}.n33-imei-box span{color:#405577;text-align:right}.n33-preview{width:min(760px,calc(100vw - 28px));height:auto;max-height:calc(100vh - 28px);margin:auto}.n33-mail{background:#fff;border:1px solid #d6e1f4}.n33-mail header{padding:20px;background:#1455a5;color:#fff;font-size:18px}.n33-mail header small{display:block;font-size:11px;margin-top:5px}.n33-mail main{padding:16px}.n33-message{padding:14px;border-left:3px solid #1455a5;background:#f1f5f9;line-height:1.5;white-space:normal}.n33-mail footer{padding:12px;text-align:center;color:#657694;background:#f4f7fc;font-size:11px}@media(max-width:700px){.n33-imei-box{grid-template-columns:1fr}}'; document.head.appendChild(css33);
}());
