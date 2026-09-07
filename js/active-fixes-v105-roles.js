/* v105: control de acceso por rol en el FRONTEND.
 *
 * Hasta ahora el backend (LDU_ACTION_ROLES_, api.gs) sí rechazaba una escritura de un rol
 * sin permiso, pero la interfaz mostraba los mismos botones a TODOS los roles por igual — un
 * usuario "Consulta" veía "+ Dispositivo", "+ Nueva Incidencia", "Editar", "Eliminar" y los
 * menús de Importar/Usuarios/Eliminar exactamente igual que un Administrador, y solo se
 * enteraba de que no tenía permiso al hacer clic y recibir el error del backend. Este
 * archivo oculta o deshabilita en la propia interfaz lo que el rol de la sesión no puede
 * hacer, reflejando la MISMA tabla LDU_ACTION_ROLES_ que ya usa el backend — duplicada aquí
 * a propósito (frontend y backend son runtimes separados y no pueden compartir un objeto
 * JS), igual que este proyecto ya duplica los catálogos de Grupo A/B entre normalizers.gs y
 * el frontend (ver el comentario al inicio de normalizers.gs). Si cambias los permisos de un
 * rol en api.gs, replica el cambio aquí también.
 *
 * Esto es una mejora de UX, no el mecanismo de seguridad real: el backend ya rechaza
 * cualquier escritura sin permiso sin importar lo que haga o deje de hacer el frontend.
 */
(function () {
  'use strict';

  var ROLE_ACTIONS_ = {
    createDevice: ['Administrador', 'Operador'], updateDevice: ['Administrador', 'Operador'], deleteDevice: ['Administrador'],
    createIncident: ['Administrador', 'Supervisor', 'Operador'], updateIncident: ['Administrador', 'Supervisor', 'Operador'], deleteIncident: ['Administrador'],
    createUser: ['Administrador'], updateUser: ['Administrador'], deleteUser: ['Administrador'], listUsers: ['Administrador'],
    clearSheet: ['Administrador'], setup: ['Administrador'], reconcileStock: ['Administrador'], formatDates: ['Administrador'], formatMoney: ['Administrador'],
    sendNotification: ['Administrador', 'Supervisor', 'Operador'],
    importRows: ['Administrador', 'Operador']
  };

  function lduRole_() {
    try {
      var raw = sessionStorage.getItem('ldu-session');
      if (!raw) return '';
      var user = JSON.parse(raw); user = user.data || user;
      return String(user.rol || user.role || '').trim();
    } catch (e) { return ''; }
  }
  /* Sin entrada en ROLE_ACTIONS_ = sin restricción (mismo criterio que _lduCheckPermission_
   * en api.gs: lecturas, login/logout/health, etc. quedan siempre abiertas). */
  function lduCan_(action) { var allowed = ROLE_ACTIONS_[action]; return !allowed || allowed.indexOf(lduRole_()) >= 0; }
  window.lduCan = lduCan_;

  function lockElement_(el) {
    if (!el || el.dataset.lduRoleLocked === '1') return;
    el.dataset.lduRoleLocked = '1';
    el.disabled = true;
    el.title = 'Tu rol (' + (lduRole_() || 'sin sesión') + ') no tiene permiso para esta acción.';
    el.style.opacity = '.45';
    el.style.cursor = 'not-allowed';
  }

  /* Ítems del menú lateral que dependen por completo de una acción restringida — más simple
   * y confiable ocultar el ítem entero que tratar de deshabilitar cada botón dentro de esos
   * módulos uno por uno. */
  var NAV_RULES_ = { delete: 'deleteDevice', import: 'importRows', users: 'listUsers', notifications: 'sendNotification' };
  function applyNavRules_() {
    /* display:none en vez de remove(): un cambio de rol en la vida real siempre pasa por
     * cerrar sesión (location.reload() en el logout, ver active-fixes-v97.js), así que esto
     * casi nunca se re-evalúa con la MISMA página viva — pero display:none es reversible sin
     * costo, así que no hay motivo para arriesgar un ítem que no vuelve a aparecer. */
    Object.keys(NAV_RULES_).forEach(function (view) {
      var btn = document.querySelector('.nav-item[data-view="' + view + '"]');
      if (btn) btn.style.display = lduCan_(NAV_RULES_[view]) ? '' : 'none';
    });
  }
  var baseRenderNav = window.renderNav;
  if (typeof baseRenderNav === 'function') window.renderNav = renderNav = function () {
    var result = baseRenderNav.apply(this, arguments);
    applyNavRules_();
    return result;
  };

  /* Botones de acción dentro de cada módulo (Inventario/Modelos A/B, Stock, Incidencias) que
   * SÍ deben seguir visibles (el módulo en sí es de solo lectura para Consulta) pero
   * deshabilitados si el rol no puede editar/eliminar. */
  var BUTTON_RULES_ = [
    ['[data-v26-device="edit"]', 'updateDevice'], ['[data-v26-device="delete"]', 'deleteDevice'],
    ['[data-v98-stock-edit]', 'updateDevice'], ['[data-v98-stock-del]', 'deleteDevice'],
    ['[data-v98-inc-edit]', 'updateIncident'], ['[data-v98-inc-del]', 'deleteIncident'],
    ['button[onclick="openIncidentForm()"]', 'createIncident']
  ];
  function applyButtonRules_() {
    BUTTON_RULES_.forEach(function (pair) {
      if (lduCan_(pair[1])) return;
      document.querySelectorAll(pair[0]).forEach(lockElement_);
    });
    if (!lduCan_('createDevice')) lockElement_(document.querySelector('.top-action.primary[onclick="openDeviceForm()"]'));
  }

  var appHost = document.querySelector('#app');
  if (appHost) new MutationObserver(applyButtonRules_).observe(appHost, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', function () { applyNavRules_(); applyButtonRules_(); });
  setTimeout(function () { applyNavRules_(); applyButtonRules_(); }, 300);
  document.addEventListener('ldu:session-changed', function () { setTimeout(function () { applyNavRules_(); applyButtonRules_(); }, 50); });
}());
