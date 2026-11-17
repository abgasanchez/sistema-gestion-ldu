/* v176: pedido del usuario — todo equipo Dañado, Perdido o en Baja debe tener una incidencia. Al
 * guardar un dispositivo (Inventario, Modelos A/B, IMEI NO VIVO) con uno de esos estados y SIN
 * incidencia registrada para ese IMEI, el sistema pregunta si se quiere generarla y, si se acepta,
 * abre "Nueva incidencia" ya con los datos del equipo y el tipo sugerido (Dañado→Daño,
 * Perdido→Pérdida, Baja→Otro). En Baja el IMEI Nuevo es OBLIGATORIO (una baja siempre trae el IMEI
 * del equipo de reemplazo). No crea nada solo y no toca el Stock: la actualización automática del
 * estado en Stock sigue funcionando igual. No aplica a cambios de estado hechos desde Stock. */
(function () {
  'use strict';
  var nz = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim(); };
  var SUGGEST = { DANADO: 'Daño', PERDIDO: 'Pérdida', BAJA: 'Otro' };
  var WATCHED = { createDevice: 1, updateDevice: 1, createImeiNoVivo: 1 };
  var asking = false;

  async function suggestIncident(device) {
    var imei = String(device.imei || '').replace(/\D/g, '');
    var estado = nz(device.estado);
    if (!imei || !SUGGEST[estado] || asking) return;
    asking = true;
    try {
      var busy = window.lduBusy && window.lduBusy.start('Verificando incidencias…', 2, 0), list = [];
      try { var r = await api('listIncidents'); list = (r && r.data) || []; } finally { if (window.lduBusy) window.lduBusy.end(busy); }
      var has = list.some(function (x) { return String(x.imei_original || x.imei || '').replace(/\D/g, '') === imei; });
      if (has) return;
      var label = String(device.estado || '').toUpperCase();
      var extra = estado === 'BAJA' ? '\n\nUna BAJA requiere el IMEI NUEVO del equipo de reemplazo.' : '';
      await new Promise(function (resolve) { setTimeout(resolve, 400); }); /* deja que el indicador de carga se oculte antes de mostrar la pregunta */
      if (!confirm('El IMEI ' + imei + ' quedó en estado ' + label + ' y no tiene una incidencia registrada.\n\n¿Quieres generar la incidencia ahora?' + extra)) return;
      var prefill = { imei_original: imei, tipo: SUGGEST[estado], marca: device.marca || '', modelo: device.modelo || '', n_linea: device.n_linea || '', responsable: device.responsable || device.nombre_completo || '', dni: device.dni || '', cargo: device.cargo || '', supervisor: device.supervisor || '', zona: device.zona || '', tipo_uso: device.tipo_uso || '', observaciones: device.observaciones || '' };
      openIncidentForm(prefill);
      setTimeout(function () {
        var drawers = document.querySelectorAll('.drawer'), form = drawers[drawers.length - 1], nuevo = form && form.querySelector('[name="imei_nuevo"]');
        if (nuevo && estado === 'BAJA') { nuevo.value = nuevo.value === 'N/A' ? '' : nuevo.value; nuevo.required = true; nuevo.placeholder = 'IMEI del equipo de reemplazo (obligatorio por BAJA)'; nuevo.focus(); }
      }, 150);
    } catch (e) { /* una falla aquí nunca debe afectar el guardado del dispositivo */ }
    finally { asking = false; }
  }

  var prevApi = window.api;
  if (typeof prevApi === 'function') {
    window.api = api = async function (action, payload) {
      var result = await prevApi(action, payload);
      try {
        if (WATCHED[action] && result && result.status === 'ok' && payload && payload.device) {
          var device = Object.assign({}, payload.device); setTimeout(function () { suggestIncident(device); }, 600);
        }
      } catch (e) {}
      return result;
    };
  }
}());
