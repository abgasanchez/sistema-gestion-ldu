/* v183: pedido del usuario — "verifica que la sincronización al actualizar la información se haga en
 * línea y de forma inmediata: cuando visualizo en Buscador desde otra ventana los cambios no se
 * muestran". Antes cada pestaña guardaba su propia copia de los datos (5 min) y nada la avisaba de los
 * cambios hechos en otra pestaña, por otro usuario o directamente en el spreadsheet.
 * Ahora hay tres avisos, todos terminan en lo mismo: descartar la copia, leer de nuevo y redibujar:
 *   1) MISMA COMPUTADORA, otra ventana: al guardar algo se avisa por BroadcastChannel a las demás
 *      pestañas, que se actualizan al instante.
 *   2) OTRO USUARIO / OTRO EQUIPO / EDICIÓN EN LA HOJA: cada 30 s (solo con la pestaña visible y con
 *      actividad reciente) y al volver a la pestaña se consulta el "sello de versión" del backend
 *      (una llamada mínima); si cambió, se vuelve a leer todo.
 *   3) Al redibujar la pantalla se conservan los filtros/búsquedas escritos (campos con id) y no se
 *      redibuja mientras haya un formulario o ventana abierta o se esté escribiendo: queda pendiente y se
 *      aplica al terminar. Eliminar e Importar nunca se redibujan solos (tienen selección en curso). */
(function () {
  'use strict';
  var POLL_MS = 30000, IDLE_MS = 10 * 60 * 1000;
  var REDRAW_VIEWS = { dashboard: 1, inventory: 1, incidents: 1, stock: 1, modelA: 1, modelB: 1, search: 1, imeiNoVivo: 1 };
  var lastVersion = null, checking = false, lastCheck = 0, lastActivity = Date.now(), pendingRedraw = false, channel = null, baselineTimer = null;

  function hasSession() { try { var s = JSON.parse(sessionStorage.getItem('ldu-session') || '{}'); return !!(s && s.token); } catch (e) { return false; } }
  function userBusy() {
    if (document.querySelector('.drawer, .modal')) return true;
    var a = document.activeElement, tag = a && a.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
    var busy = document.querySelector('.ldu-busy'); return !!(busy && !busy.hidden);
  }

  function saveFormState() {
    var out = [];
    document.querySelectorAll('#app input[id], #app select[id], #app textarea[id]').forEach(function (el) {
      if (el.type === 'file' || el.type === 'password') return;
      out.push({ id: el.id, value: el.value, checked: el.checked, type: el.type });
    });
    return out;
  }
  function restoreFormState(saved, tries) {
    tries = tries || 0;
    var loading = document.querySelector('#app .loading');
    if ((loading || !document.querySelector('#app *')) && tries < 60) { setTimeout(function () { restoreFormState(saved, tries + 1); }, 300); return; }
    saved.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || (el.value && el.value !== '' && f.type !== 'checkbox' && f.type !== 'radio')) return;
      if (f.type === 'checkbox' || f.type === 'radio') { if (el.checked !== f.checked) { el.checked = f.checked; el.dispatchEvent(new Event('change', { bubbles: true })); } return; }
      if (f.value === '' || f.value == null) return;
      el.value = f.value;
      if (el.tagName === 'SELECT' && el.value !== f.value) return; /* la opción ya no existe */
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  function redraw() {
    if (!hasSession() || typeof navigate !== 'function') return;
    var view = (typeof state !== 'undefined' && state) ? state.view : '';
    if (!REDRAW_VIEWS[view]) { pendingRedraw = false; return; }
    if (userBusy()) { pendingRedraw = true; return; }
    pendingRedraw = false;
    var saved = saveFormState();
    navigate(view);
    restoreFormState(saved, 0);
  }
  setInterval(function () { if (pendingRedraw && !userBusy()) redraw(); }, 3000);
  document.addEventListener('ldu:data-changed', redraw);

  function refreshData() {
    if (typeof window.lduRefreshSnapshot !== 'function') return Promise.resolve();
    return window.lduRefreshSnapshot().catch(function () {});
  }
  function checkVersion(force) {
    if (checking || !hasSession() || document.hidden || typeof apiJsonp !== 'function') return;
    if (!force && Date.now() - lastCheck < 4000) return;
    if (Date.now() - lastActivity > IDLE_MS) return;
    checking = true; lastCheck = Date.now();
    apiJsonp('getDataVersion', {}).then(function (r) {
      var v = r && r.status === 'ok' && r.data && r.data.v;
      if (!v) return;
      if (lastVersion === null) { lastVersion = v; return; }
      if (v !== lastVersion) { lastVersion = v; refreshData(); }
    }).catch(function () {}).then(function () { checking = false; });
  }
  setInterval(function () { checkVersion(false); }, POLL_MS);
  ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function () { var wasIdle = Date.now() - lastActivity > IDLE_MS; lastActivity = Date.now(); if (wasIdle) checkVersion(true); }, { passive: true });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkVersion(true); });
  window.addEventListener('focus', function () { checkVersion(true); });
  document.addEventListener('ldu:session-changed', function () { lastVersion = null; setTimeout(function () { checkVersion(true); }, 200); });
  setTimeout(function () { checkVersion(true); }, 1500);

  /* aviso a las otras pestañas del mismo navegador cuando ESTA guarda algo */
  try { channel = new BroadcastChannel('ldu-sync'); } catch (e) { channel = null; }
  if (channel) channel.onmessage = function (ev) {
    if (!ev || !ev.data || ev.data.t !== 'write' || !hasSession()) return;
    if (typeof window.lduInvalidateSnapshot === 'function') window.lduInvalidateSnapshot();
    lastVersion = null; refreshData(); setTimeout(function () { checkVersion(true); }, 1500);
  };
  var READ = /^(list|get|lookup|health|login|logout|diagnose)/i, prevApi = window.api;
  if (typeof prevApi === 'function') {
    window.api = api = async function (action, payload) {
      var result = await prevApi(action, payload);
      try {
        if (!READ.test(String(action)) && result && result.status === 'ok') {
          if (channel) channel.postMessage({ t: 'write', at: Date.now() });
          /* esta pestaña ya tiene lo nuevo: se toma el nuevo sello como base para no releer sin necesidad */
          clearTimeout(baselineTimer); baselineTimer = setTimeout(function () { lastVersion = null; checkVersion(true); }, 2500);
        }
      } catch (e) {}
      return result;
    };
  }
}());
