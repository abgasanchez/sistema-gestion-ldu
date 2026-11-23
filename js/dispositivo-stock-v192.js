/* v192: pedido del usuario — al agregar un dispositivo NUEVO y escribir un IMEI que ya está en Stock, el formulario
 * debe traer por defecto el MONTO (y el MODELO) registrados en Stock. Antes solo se completaba si el campo estaba vacío y
 * dependía de una consulta aparte al backend que no traía el monto. Ahora se toma del Stock ya cargado en el sistema
 * (instantáneo, sin esperar al servidor) apenas el IMEI tiene 15+ dígitos. Es solo la sugerencia visible: el backend
 * (validators.gs) igualmente guarda el monto y el modelo de Stock. En edición de un equipo existente no se toca nada. */
(function () {
  'use strict';
  var base = (typeof openDeviceForm === 'function') ? openDeviceForm : null;
  if (!base) return;
  function attach(existing) {
    if (existing && existing.id_dispositivo) return;
    var drawers = document.querySelectorAll('.drawer'), drawer = drawers[drawers.length - 1], form = drawer && drawer.querySelector('#device-form');
    if (!form) return;
    var imei = form.querySelector('[name="imei"]'), monto = form.querySelector('[name="monto"]'), modelo = form.querySelector('[name="modelo"]');
    if (!imei || !monto) return;
    var hint = document.createElement('small'); hint.className = 'muted'; hint.style.cssText = 'display:block;margin-top:4px';
    (monto.closest('label') || monto.parentElement).appendChild(hint);
    var timer = null, last = '';
    function apply() {
      var digits = String(imei.value || '').replace(/\D/g, '');
      if (digits.length < 15 || digits === last) return;
      last = digits;
      if (typeof window.getLduSnapshot !== 'function') return;
      window.getLduSnapshot(false).then(function (s) {
        var st = (s.stock || []).filter(function (r) { return String(r.imei || '').replace(/\D/g, '') === digits; })[0];
        if (!st) { hint.textContent = 'ℹ️ Este IMEI no está en Stock: no hay monto por defecto.'; return; }
        var m = Number(String(st.monto == null ? '' : st.monto).replace(/[^0-9.\-]/g, ''));
        if (m > 0) { monto.value = m; monto.dispatchEvent(new Event('input', { bubbles: true })); hint.textContent = '💰 Monto tomado del Stock: S/ ' + m.toFixed(2); }
        else hint.textContent = 'ℹ️ El Stock de este IMEI no tiene monto registrado.';
        if (modelo && st.modelo) modelo.value = st.modelo;
      }).catch(function () {});
    }
    imei.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 300); });
    imei.addEventListener('blur', apply);
    apply();
  }
  window.openDeviceForm = openDeviceForm = function (existing) {
    var r = base.apply(this, arguments);
    try { attach(existing || {}); } catch (e) {}
    return r;
  };
}());
