(function () {
  /* 1. Restaurar Notificaciones al flujo anterior a v31. */
  renderNotifications = window.renderNotifications = async function () {
    loading('Cargando notificaciones...');
    try {
      var devices = renderUnifiedRows(await loadUnified()), result = await api('listNotifications');
      document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>🔔 Notificaciones</h2></div><form id="notification-form" class="device-form"><h3>📱 Seleccionar dispositivo(s)</h3><input id="notification-device-q" class="input" placeholder="Busca por IMEI, Responsable, Supervisor, Modelo..."><div id="notification-devices" class="selection-list"></div><h3>📤 Redactar y enviar</h3><div class="form-grid">' + selectField('Tipo de notificación','type',['⚠️ Incidencia registrada','📦 Cambio de stock','📋 Cambio de responsable']) + field('Asunto','subject','text','Notificación LDU','required') + '<label class="full-field"><span>Destinatarios (1 a 4 correos, separados por coma) *</span><input class="input" name="recipient" type="text" placeholder="correo1@dominio.com, correo2@dominio.com" required></label>' + field('CC','cc','text','') + '<label class="full-field"><span>Mensaje</span><textarea class="input" name="message" required></textarea></label></div><p class="form-note">Los correos se envían únicamente a los correos ingresados manualmente en este formulario. La cuenta de Gmail es utilizada como remitente.</p><div id="notification-msg"></div><button class="btn" type="submit">📤 Enviar correo</button><button class="btn secondary" type="reset">🗑️ Limpiar</button></form></section><section class="section"><div class="section-head"><h2>📋 Historial de Notificaciones Enviadas</h2></div>' + table(result.data || [], ['timestamp','type','subject','recipient','zona','role','email','cc','sender','status']) + '</section>';
      var drawDevices = function () { var q = norm(document.querySelector('#notification-device-q').value); document.querySelector('#notification-devices').innerHTML = devices.filter(function (x) { return !q || Object.values(x).some(function (v) { return norm(v).includes(q); }); }).slice(0, 20).map(function (x) { return '<label class="selection-row"><input type="checkbox" name="selected_imei" value="' + safe(x.imei) + '"> <b>' + safe(x.imei) + '</b> · ' + safe(x.responsable || x.modelo) + ' · ' + safe(x.modulo) + '</label>'; }).join('') || '<div class="empty">Sin coincidencias</div>'; };
      document.querySelector('#notification-device-q').oninput = drawDevices; drawDevices();
      document.querySelector('#notification-form').onsubmit = async function (event) { event.preventDefault(); var form = new FormData(event.target), recipients = String(form.get('recipient') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (recipients.length < 1 || recipients.length > 4) return alert('Ingresa entre 1 y 4 destinatarios.'); var selected = Array.from(document.querySelectorAll('[name="selected_imei"]:checked')).map(function (x) { return x.value; }), message = document.querySelector('#notification-msg'); message.textContent = 'Enviando...'; var response = await api('sendNotification', { notification: { type: form.get('type'), subject: form.get('subject'), recipient: recipients.join(','), cc: form.get('cc'), message: form.get('message'), imeis: selected }, userId: 'web-user' }); message.textContent = response.status === 'ok' ? 'Notificación enviada y registrada.' : (response.message || 'No se pudo enviar.'); };
    } catch (error) { errorView('No se pudo cargar Notificaciones', error, 'renderNotifications'); }
  };

  /* 2. Búsqueda: asegurar que las acciones siempre trabajen sobre la fila visible. */
  function bindSearchActions32() {
    var host = document.querySelector('.v31-search'); if (!host || host.dataset.v32Actions) return; host.dataset.v32Actions = '1';
    host.addEventListener('click', async function (event) {
      var button = event.target.closest('[data-v31-action]'); if (!button) return; event.preventDefault(); event.stopImmediatePropagation();
      var rows = window.__searchRows || [], row = rows[Number(button.dataset.index)]; if (!row) return;
      if (button.dataset.v31Action === 'view') return showDetail(row);
      if (button.dataset.v31Action === 'history') { state.historyImei = row.imei || row.imei_original; return navigate('history'); }
      if (button.dataset.v31Action === 'edit') return row._kind === 'incident' ? openIncidentForm(Object.assign({}, row, { imei_original: row.imei_original || row.imei })) : openDeviceForm(row);
      if (button.dataset.v31Action === 'delete' && confirm('¿Enviar este registro al módulo Eliminar?')) { await api('deleteDevice', { imei: row.imei || row.imei_original, justification: 'Eliminación desde Buscador', userId: 'web-user' }); if (typeof renderSearch === 'function') renderSearch(); }
    }, true);
  }
  new MutationObserver(bindSearchActions32).observe(document.querySelector('#app'), { childList: true, subtree: true });

  /* 3. Tarjetas clicables en Dashboard y módulos, sin modificar las tarjetas ni sus datos. */
  function bindCards32() {
    document.querySelectorAll('#app .metric').forEach(function (card) {
      if (card.dataset.v32Card) return; var label = n32(card.querySelector('span') ? card.querySelector('span').textContent : card.textContent); if (!label) return; card.dataset.v32Card = '1'; card.classList.add('is-clickable');
      card.onclick = function () {
        var deviceHost = card.closest('#v26-dcards'), deviceTitle = deviceHost && deviceHost.closest('.section') ? n32(deviceHost.closest('.section').querySelector('h2') ? deviceHost.closest('.section').querySelector('h2').textContent : '') : '';
        var module = card.closest('.dashboard-incidents') ? 'incidents' : card.closest('.dashboard-module') ? (card.closest('.dashboard-module').classList.contains('a') ? 'modelA' : card.closest('.dashboard-module').classList.contains('b') ? 'modelB' : 'inventory') : deviceHost ? (deviceTitle.includes('ANTIGUOS A') ? 'modelA' : deviceTitle.includes('ANTIGUOS B') ? 'modelB' : 'inventory') : card.closest('.dashboard-overview') ? (label.includes('STOCK') ? 'stock' : 'inventory') : '';
        if (!module) return; navigate(module);
        setTimeout(function () {
          var isIncident = module === 'incidents', field = document.querySelector(isIncident ? '#v26-i-tipo' : '#v26-d-estado');
          if (isIncident && /PENDIENTE|CURSO/.test(label)) field = document.querySelector('#v26-i-estado_proceso');
          if (!field || /TOTAL|STOCK|CUENTA|MODELO|MODULO/.test(label)) return;
          var wanted = label.replace(/^.*?\b(ACTIVOS?|DAÑADOS?|PERDIDOS?|DEVUELTOS?|PENDIENTES?|DAÑOS?|PÉRDIDAS?|ROBOS?|REPOSICIONES?|DEVOLUCIONES?|OTROS?)\b.*$/, '$1');
          wanted = wanted.replace(/ACTIVOS?/, 'ACTIVO').replace(/DAÑADOS?/, isIncident ? 'DAÑO' : 'DAÑADO').replace(/PERDIDOS?/, isIncident ? 'PÉRDIDA' : 'PERDIDO').replace(/DEVUELTOS?/, isIncident ? 'DEVOLUCIÓN' : 'DEVUELTO').replace(/PENDIENTES?/, 'PENDIENTE').replace(/DAÑOS?/, 'DAÑO').replace(/PÉRDIDAS?/, 'PÉRDIDA').replace(/ROBOS?/, 'ROBO').replace(/REPOSICIONES?/, 'REPOSICIÓN').replace(/DEVOLUCIONES?/, 'DEVOLUCIÓN').replace(/OTROS?/, 'OTRO');
          var option = Array.from(field.options).find(function (item) { return n32(item.value) === n32(wanted) || n32(item.textContent) === n32(wanted); });
          if (option) { field.value = option.value; field.dispatchEvent(new Event('input', { bubbles: true })); }
        }, 300);
      };
    });
  }
  var n32 = function (v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  new MutationObserver(bindCards32).observe(document.querySelector('#app'), { childList: true, subtree: true });

  /* 4. Solo espaciado/altura visual solicitado para Inventario, A/B y recientes. */
  var css32 = document.createElement('style'); css32.textContent = '.dashboard-recent .section{min-height:0}.dashboard-recent .table-wrap{max-height:145px;overflow:auto}.dashboard-recent table th,.dashboard-recent table td{padding:7px 9px;font-size:11px}.dashboard-recent .section-head{padding:8px 12px}.dashboard-module{margin-bottom:22px}.dashboard-module #v26-dcards,.dashboard-module .module-cards,.v26-dcards{margin-bottom:20px}.v26-search-only{margin-top:12px;margin-bottom:14px}.v26-dcards+.v26-search-only{margin-top:12px}.v26-module-filters{margin-top:0;margin-bottom:16px}.v26-module-filters+.table-wrap{margin-top:8px}.v31-search .row-actions button{min-width:32px}#v25-history-q{min-width:420px;min-height:40px}@media(max-width:700px){#v25-history-q{min-width:100%}}'; document.head.appendChild(css32);
}());
