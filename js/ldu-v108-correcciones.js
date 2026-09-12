/* v108: correcciones pedidas sobre el módulo IMEI NO VIVO y el Dashboard.
 *   1) Las tarjetas GENERALES del Dashboard (la fila de arriba, antes de cualquier sección
 *      "Estados — …") ahora suman también los dispositivos de LDU_IMEI_No_Vivo (antes solo
 *      sumaban Inventario+Modelos A/B, así que "TOTAL DEVUELTOS" y el resto quedaban por
 *      debajo del total real) y muestran de nuevo "TOTAL IMEI NO VIVO" — pero solo ahí, no en
 *      cada sección "Estados — …" (que ya tienen su propio total, sería redundante).
 *   2) Esas mismas tarjetas generales ya NO filtran ni navegan al tocarlas (antes sí, por
 *      error) — esa función queda solo para las tarjetas de sección: Estados — Inventario
 *      LDU/Modelos A/Modelos B/IMEI NO VIVO e Incidencias, y ahora cada una lleva al módulo
 *      CORRECTO (antes, sin importar qué sección tocaras, siempre te mandaba a Inventario LDU).
 *   3) Buscador ahora también consulta LDU_IMEI_No_Vivo — antes no, así que un IMEI migrado a
 *      esa hoja aparecía en el buscador solo con su fila de Stock (si tenía una), con todos los
 *      campos de dispositivo (responsable, dni, supervisor, etc.) vacíos.
 * Depende de que ya estén cargados: state, api, totals/syncedTotals, overviewCards, card, safe,
 * money, badge, groupFor, navigate, lduIncidentCards (todos definidos en archivos anteriores).
 */
(function () {
  'use strict';

  var N = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };

  /* ---------------------------------------------------------------------
   * 1) renderDashboard: precarga state.imeiNoVivo ANTES de que se calculen
   *    los totales generales, para que salgan sincronizados desde el primer
   *    render (no solo después de que la sección de abajo termine de cargar).
   * ------------------------------------------------------------------- */
  /* v110: antes se esperaba 'listImeiNoVivo' ANTES de llamar a la función base — eso suma
   * un viaje de red completo, en serie, a cada carga del Dashboard (uno de los motivos de la
   * lentitud reportada). Ahora se dispara en paralelo con lo que la función base ya pide
   * (listDevices/listStock/listIncidents vía loadSync24): las promesas corren al mismo tiempo,
   * así que el costo real es el de la más lenta de todas, no la suma de todas. */
  var baseRenderDashboard108_ = window.renderDashboard;
  if (typeof baseRenderDashboard108_ === 'function') {
    window.renderDashboard = renderDashboard = async function () {
      var noVivoPromise = api('listImeiNoVivo')
        .then(function (r) { state.imeiNoVivo = (r && r.data) || []; })
        .catch(function () { state.imeiNoVivo = state.imeiNoVivo || []; });
      var result = await baseRenderDashboard108_.apply(this, arguments);
      await noVivoPromise;
      return result;
    };
  }

  /* ---------------------------------------------------------------------
   * 2) totals(): sin argumentos = llamada GENERAL (fila de arriba del
   *    Dashboard) — se le suma IMEI NO VIVO y se marca t.__general para que
   *    overviewCards() sepa que debe mostrar tarjetas planas (sin clic) más
   *    la de IMEI NO VIVO. Con (rows, group) = llamada por sección/módulo —
   *    se marca t.__target con el módulo real (antes esa información se
   *    perdía y el clic siempre mandaba a Inventario LDU).
   * ------------------------------------------------------------------- */
  var G108_ = function (m) { return typeof groupFor === 'function' ? groupFor(m) : 'INVENTARIO'; };
  var baseTotals108_ = window.totals;
  if (typeof baseTotals108_ === 'function') {
    window.totals = totals = function (rows, group) {
      if (rows === undefined && group === undefined) {
        /* v111: pedido explícito del usuario — la tarjeta general debe ser la SUMA LITERAL de
         * las 4 secciones "Estados — …" (Inventario LDU + Modelos A + Modelos B + IMEI NO
         * VIVO), campo por campo. La ÚNICA excepción es TOTAL STOCK / TOTAL FALTANTE / TOTAL
         * IMEI NO INVENTARIO: esas tres van atadas 1:1 al Resumen de Stock por Modelo (que es
         * el dueño real de esas cifras) y NUNCA deben variar según cómo se sumen las
         * secciones — se calculan aparte, sin tocarlas. */
        var devices = state.devices || [];
        var tInv = baseTotals108_(devices.filter(function (d) { return G108_(d.modelo) === 'INVENTARIO'; }), 'INVENTARIO');
        var tA = baseTotals108_(devices.filter(function (d) { return G108_(d.modelo) === 'A'; }), 'A');
        var tB = baseTotals108_(devices.filter(function (d) { return G108_(d.modelo) === 'B'; }), 'B');
        var noVivo = state.imeiNoVivo || [];
        var byStateNoVivo = function (s) { return noVivo.filter(function (r) { return N(r.estado) === N(s); }).length; };
        var moneyOf = function (r) { var n = Number(String(r.monto != null && r.monto !== '' ? r.monto : r.valor || 0).replace(/[^0-9.-]/g, '')); return isFinite(n) ? n : 0; };
        var tNoVivo = {
          act: byStateNoVivo('Activo'), alm: byStateNoVivo('Almacén'), dan: byStateNoVivo('Dañado'),
          rep: byStateNoVivo('En Reparación'), per: byStateNoVivo('Perdido'), baja: byStateNoVivo('Baja'),
          pdev: byStateNoVivo('Pendiente Devolución'), dev: byStateNoVivo('Devuelto'),
          valor: noVivo.reduce(function (a, r) { return a + moneyOf(r); }, 0)
        };
        var sum = function (key) { return (tInv[key] || 0) + (tA[key] || 0) + (tB[key] || 0) + (tNoVivo[key] || 0); };
        var tStock = baseTotals108_(); // TOTAL STOCK/TOTAL FALTANTE/TOTAL IMEI NO INVENTARIO: solo Stock decide esto
        return {
          stock: tStock.stock, falt: tStock.falt, noInv: tStock.noInv,
          act: sum('act'), alm: sum('alm'), dan: sum('dan'), rep: sum('rep'), per: sum('per'),
          baja: sum('baja'), pdev: sum('pdev'), dev: sum('dev'), valor: sum('valor'),
          __general: true, noVivoCount: noVivo.length
        };
      }
      var t2 = baseTotals108_(rows, group);
      t2.__target = group === 'A' ? 'modelA' : group === 'B' ? 'modelB' : 'inventory';
      return t2;
    };
  }

  /* ---------------------------------------------------------------------
   * 3) overviewCards(): reemplazo completo — antes clickableCard() (dentro
   *    de final-corrections-v90.js) llamaba siempre a goToStateFilter(), que
   *    a su vez hacía navigate('inventory') sin importar el grupo. Ahora la
   *    tarjeta general (t.__general) sale plana y sin clic; las de sección
   *    (t.__target) navegan al módulo correcto y aplican el filtro ahí.
   * ------------------------------------------------------------------- */
  window.overviewCards = overviewCards = function (t) {
    t = t || {};
    if (t.__general) {
      return '<div class="cards dashboard-overview">'
        + card('📦 TOTAL STOCK', t.stock) + card('✅ TOTAL ACTIVOS', t.act) + card('🏬 TOTAL EN ALMACÉN', t.alm)
        + card('🛠️ TOTAL DAÑADOS', t.dan) + card('🔧 TOTAL EN REPARACIÓN', t.rep) + card('🔎 TOTAL PERDIDOS', t.per)
        + card('⛔ TOTAL EN BAJA', t.baja) + card('📦 PENDIENTE DE DEVOLUCIÓN', t.pdev) + card('↩️ TOTAL DEVUELTOS', t.dev)
        + card('⚠️ TOTAL FALTANTE', t.falt) + card('🚫 TOTAL IMEI NO INVENTARIO', t.noInv)
        + card('📵 TOTAL IMEI NO VIVO', t.noVivoCount || 0)
        + card('💰 VALOR TOTAL', window.money(t.valor)) + '</div>';
    }
    var target = t.__target || 'inventory';
    function cc(label, value, stateName) {
      return '<article class="metric metric-clickable" data-ldu-goto="' + target + '" data-ldu-value="' + safe(stateName) + '"><strong>' + safe(String(value)) + '</strong><span>' + safe(label) + '</span></article>';
    }
    return '<div class="cards dashboard-overview">'
      + card('📦 TOTAL STOCK', t.stock) + card('✅ TOTAL ACTIVOS', t.act) + card('🏬 TOTAL EN ALMACÉN', t.alm)
      + cc('🛠️ TOTAL DAÑADOS', t.dan, 'Dañado') + cc('🔧 TOTAL EN REPARACIÓN', t.rep, 'En Reparación')
      + cc('🔎 TOTAL PERDIDOS', t.per, 'Perdido') + cc('⛔ TOTAL EN BAJA', t.baja, 'Baja')
      + cc('📦 PENDIENTE DE DEVOLUCIÓN', t.pdev, 'Pendiente Devolución') + cc('↩️ TOTAL DEVUELTOS', t.dev, 'Devuelto')
      + card('⚠️ TOTAL FALTANTE', t.falt) + card('🚫 TOTAL IMEI NO INVENTARIO', t.noInv)
      + card('💰 VALOR TOTAL', window.money(t.valor)) + '</div>';
  };

  /* Delegado único de clic para toda tarjeta "ir al módulo y filtrar" — usado por
   * overviewCards() de aquí arriba y por imeiNoVivoCards() (ldu-v107-imei-no-vivo.js), que
   * arma sus tarjetas con los mismos atributos data-ldu-goto/data-ldu-value/data-ldu-selector. */
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('[data-ldu-goto]');
    if (!el) return;
    var target = el.dataset.lduGoto, value = el.dataset.lduValue, selector = el.dataset.lduSelector || '#v26-d-estado';
    navigate(target);
    var tries = 0, timer = setInterval(function () {
      tries++;
      var sel = document.querySelector(selector);
      if (sel) { sel.value = value; sel.dispatchEvent(new Event('input')); sel.dispatchEvent(new Event('change')); clearInterval(timer); }
      else if (tries > 40) clearInterval(timer);
    }, 100);
  });

  /* ---------------------------------------------------------------------
   * 4) Incidencias: la sección del Dashboard usa window.lduIncidentCards
   *    (active-fixes-v98.js) — antes esas tarjetas eran de solo lectura,
   *    ahora las accionables (todas menos TOTAL/VALOR TOTAL/SIN DEFINIR)
   *    llevan al módulo Incidencias con el filtro correspondiente ya
   *    aplicado (tipo/modalidad/estado del proceso).
   * ------------------------------------------------------------------- */
  function incVal108_(r, k) {
    return r[k] !== undefined && r[k] !== '' ? r[k]
      : k === 'nombre' ? (r.nombre_completo || r.responsable || '')
      : k === 'documentos_adjuntos' ? (r.doc_adjunto || r.documentos || '')
      : k === 'modalidad' ? (r.modality || '')
      : k === 'estado_proceso' ? (r.estadoProceso || r.estadoproceso || '')
      : '';
  }
  function incCount108_(rows, field, val) { return rows.filter(function (r) { return N(incVal108_(r, field)) === N(val); }).length; }
  function incClickable108_(label, count, field, value) {
    return '<article class="metric metric-clickable" data-ldu-inc-goto="1" data-ldu-inc-field="' + field + '" data-ldu-inc-value="' + safe(value) + '"><strong>' + safe(String(count)) + '</strong><span>' + safe(label) + '</span></article>';
  }
  window.lduIncidentCards = function (rows) {
    rows = rows || [];
    var valor = rows.reduce(function (t, r) { var n = Number(String(incVal108_(r, 'valor') || 0).replace(/[^0-9.-]/g, '')); return t + (isFinite(n) ? n : 0); }, 0);
    return card('📊 TOTAL', rows.length)
      + incClickable108_('⏳ PENDIENTES', incCount108_(rows, 'estado_proceso', 'Pendiente'), 'estado_proceso', 'Pendiente')
      + incClickable108_('🔄 EN CURSO', incCount108_(rows, 'estado_proceso', 'En Curso'), 'estado_proceso', 'En Curso')
      + incClickable108_('✅ FINALIZADO', incCount108_(rows, 'estado_proceso', 'Finalizado'), 'estado_proceso', 'Finalizado')
      + incClickable108_('➖ DESCONTADO', incCount108_(rows, 'estado_proceso', 'Descontado'), 'estado_proceso', 'Descontado')
      + incClickable108_('💥 DAÑOS', incCount108_(rows, 'tipo', 'Daño'), 'tipo', 'Daño')
      + incClickable108_('🔍 PÉRDIDAS', incCount108_(rows, 'tipo', 'Pérdida'), 'tipo', 'Pérdida')
      + incClickable108_('🕵️ ROBOS', incCount108_(rows, 'tipo', 'Robo'), 'tipo', 'Robo')
      + incClickable108_('📌 OTROS (TIPO)', incCount108_(rows, 'tipo', 'Otro'), 'tipo', 'Otro')
      + incClickable108_('🔁 REPOSICIÓN', incCount108_(rows, 'modalidad', 'Reposición'), 'modalidad', 'Reposición')
      + incClickable108_('💸 DESCUENTO', incCount108_(rows, 'modalidad', 'Descuento'), 'modalidad', 'Descuento')
      + incClickable108_('💳 PAGO', incCount108_(rows, 'modalidad', 'Pago'), 'modalidad', 'Pago')
      + incClickable108_('🕓 MODALIDAD PENDIENTE', incCount108_(rows, 'modalidad', 'Pendiente'), 'modalidad', 'Pendiente')
      + card('❔ SIN DEFINIR', rows.filter(function (r) { var v = incVal108_(r, 'modalidad'); return !v || N(v) === 'SIN DEFINIR'; }).length)
      + card('💰 VALOR TOTAL', 'S/ ' + valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  var INC_FIELD_SELECTOR_108_ = { tipo: '#v98-itipo', modalidad: '#v98-imodalidad', estado_proceso: '#v98-iestado' };
  document.addEventListener('click', function (event) {
    var el = event.target.closest && event.target.closest('[data-ldu-inc-goto]');
    if (!el) return;
    var field = el.dataset.lduIncField, value = el.dataset.lduIncValue, selector = INC_FIELD_SELECTOR_108_[field];
    navigate('incidents');
    var tries = 0, timer = setInterval(function () {
      tries++;
      var sel = document.querySelector(selector);
      if (sel) {
        var match = Array.prototype.find.call(sel.options, function (o) { return N(o.value) === N(value); });
        sel.value = match ? match.value : value;
        sel.dispatchEvent(new Event('change'));
        clearInterval(timer);
      } else if (tries > 40) clearInterval(timer);
    }, 100);
  });

  /* ---------------------------------------------------------------------
   * 5) Buscador: se agrega LDU_IMEI_No_Vivo como cuarta fuente — reemplazo
   *    completo de renderSearch (los campos/tabla de la versión original
   *    viven como variables internas de final-v23.js, no accesibles desde
   *    aquí, así que se reconstruyen aquí con la misma forma).
   * ------------------------------------------------------------------- */
  var SEARCH_FIELDS_108_ = ['modulo', 'imei', 'marca', 'modelo', 'n_linea', 'responsable', 'dni', 'cargo', 'tipo', 'supervisor', 'zona', 'cuenta', 'departamento', 'ciudad', 'canal', 'tienda', 'tipo_uso', 'fecha_asignacion', 'monto', 'estado', 'observaciones'];
  var SEARCH_LABELS_108_ = { modulo: 'MÓD.', imei: 'IMEI', marca: 'MARCA', modelo: 'MODELO', n_linea: 'N° L./IMEI NUEVO', responsable: 'RESP./NOMBRE', dni: 'DNI', cargo: 'CARGO', tipo: 'TIPO', supervisor: 'SUPERVISOR', zona: 'ZONA', cuenta: 'CUENTA', departamento: 'DEPARTAMENTO', ciudad: 'CIUDAD', canal: 'CANAL', tienda: 'TIENDA', tipo_uso: 'TIPO USO', fecha_asignacion: 'F. ASIG./FECHA', monto: 'MONTO S/', estado: 'ESTADO', observaciones: 'OBSERVACIONES' };
  /* v110: pedido del usuario — los estados en la tabla del Buscador deben verse con el mismo
   * color que en el resto del sistema (badge()), y una fila de Incidencias no tiene columna
   * "estado" propia (usa "estado_proceso") — sin el fallback salía en blanco.
   * v114: se agrega columna ACCIONES real (ver/historial/editar/eliminar), antes solo se
   * armaba un texto "acciones" con emojis que ni siquiera se pintaba en ninguna columna. */
  function searchTable108_(rowsOut) {
    return '<div class="table-wrap"><table><thead><tr>' + SEARCH_FIELDS_108_.map(function (f) { return '<th>' + SEARCH_LABELS_108_[f] + '</th>'; }).join('') + '<th>ACCIONES</th></tr></thead><tbody>'
      + (rowsOut.length ? rowsOut.map(function (row, idx) {
          return '<tr>' + SEARCH_FIELDS_108_.map(function (f) {
            if (f === 'estado') return '<td>' + badge(row.estado || row.estado_proceso) + '</td>';
            var value = f === 'n_linea' ? (row.n_linea || row.imei_nuevo) : f === 'responsable' ? (row.responsable || row.nombre) : f === 'fecha_asignacion' ? (row.fecha_asignacion || row.fecha_incidente) : f === 'monto' ? money(row.monto || row.valor) : row[f];
            return '<td>' + safe(value == null ? '' : value) + '</td>';
          }).join('')
          + '<td class="row-actions">'
          + '<button type="button" data-search-act="view" data-search-idx="' + idx + '">👁️</button>'
          + '<button type="button" data-search-act="history" data-search-idx="' + idx + '">📜</button>'
          + '<button type="button" data-search-act="edit" data-search-idx="' + idx + '">✎️</button>'
          + '<button type="button" data-search-act="delete" data-search-idx="' + idx + '">🗑️</button>'
          + '</td></tr>';
        }).join('') : '<tr><td colspan="' + (SEARCH_FIELDS_108_.length + 1) + '" class="empty">SIN DATOS</td></tr>')
      + '</tbody></table></div>';
  }
  /* v114: despacha editar/eliminar según el módulo real del resultado — cada módulo tiene su
   * propio formulario/acción de borrado (dispositivo, incidencia, o el dispositivo asociado
   * cuando la fila es de Stock). */
  function searchRowAction_(row, act, onDone) {
    var isIncident = row.modulo === 'INCIDENCIAS';
    var isStock = String(row.modulo || '').indexOf('STOCK') === 0;
    var device = isStock ? row.__device : row;
    if (act === 'view') { showDetail(row); return; }
    if (act === 'history') { state.historyImei = row.imei; navigate('history'); return; }
    if (act === 'edit') {
      if (isIncident) { openIncidentForm(row); return; }
      if (isStock) {
        if (device && device.imei) openDeviceForm(device);
        else alert('Este IMEI no tiene una ficha en Inventario para editar.');
        return;
      }
      openDeviceForm(row);
      return;
    }
    if (act === 'delete') {
      if (isIncident) {
        var reason = prompt('Justificación para eliminar esta incidencia (obligatoria):');
        if (!reason || !reason.trim()) return;
        api('deleteIncident', { id_incidencia: row.id_incidencia, imei: row.imei_original || row.imei, tipo: row.tipo, justification: reason.trim(), userId: lduUserId() })
          .then(function (r2) { if (r2.status !== 'ok') return alert(r2.message || 'No se pudo eliminar.'); onDone(); })
          .catch(function (e) { alert(e.message || 'No se pudo eliminar.'); });
        return;
      }
      var targetImei = isStock ? (device && device.imei) : row.imei;
      if (!targetImei) { alert('Este IMEI no tiene una ficha en Inventario para eliminar.'); return; }
      if (!confirm('¿Enviar este registro al módulo Eliminar?')) return;
      api('deleteDevice', { imei: targetImei, justification: 'Eliminación desde Buscador', userId: lduUserId() })
        .then(function () { onDone(); })
        .catch(function (e) { alert(e.message || 'No se pudo eliminar.'); });
      return;
    }
  }
  /* v113: BUG — un IMEI que Google Sheets guardó en notación científica (celda no formateada
   * como texto, p. ej. "8.6010508994763E+14") llega así tal cual desde el backend; el filtro
   * de búsqueda comparaba ese texto contra los dígitos que el usuario escribe y nunca
   * coincidía — de ahí "SIN DATOS" para IMEI que sí existen. Mismo problema que ya resuelve
   * stockKey() en final-corrections-v90.js; se replica aquí para no depender de esa variable
   * local (no está expuesta fuera de su archivo). */
  function imeiKey108_(v) {
    if ((typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && /^[0-9.]+e[+-]?\d+$/i.test(String(v).trim()))) {
      var numeric = Number(v);
      if (isFinite(numeric)) v = numeric.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
    }
    return String(v == null ? '' : v).replace(/\D/g, '');
  }
  window.renderSearch = async function () {
    loading('Cargando buscador...');
    try {
      var r = await Promise.all([api('listDevices'), api('listStock'), api('listImeiNoVivo').catch(function () { return { data: [] }; }), api('listIncidents')]);
      var devices = r[0].data || [], stock = r[1].data || [], noVivo = r[2].data || [], incidents = r[3].data || [];
      state.imeiNoVivo = noVivo;
      var G108_ = function (m) { return typeof groupFor === 'function' ? groupFor(m) : 'INVENTARIO'; };
      /* v113: mapa IMEI→dispositivo para que la fila de Stock en el Buscador muestre el ESTADO
       * real del dispositivo (antes mostraba el estado propio de Stock, casi siempre vacío —
       * "SIN ESTADO" aunque el dispositivo sí tuviera un estado real, p. ej. "Pendiente
       * Devolución"). Mismo criterio que ya usa el módulo Stock (active-fixes-v98.js, CX/SX). */
      var deviceByImei108_ = {};
      devices.concat(noVivo).forEach(function (d) { var k = imeiKey108_(d.imei); if (k && !deviceByImei108_[k]) deviceByImei108_[k] = d; });
      var rows = devices.map(function (x) { return Object.assign({}, x, { imei: imeiKey108_(x.imei), modulo: G108_(x.modelo) === 'INVENTARIO' ? 'INVENTARIO LDU' : 'MODELOS ANT. ' + G108_(x.modelo), acciones: '👁️ 📜 ✎️ ✕' }); })
        .concat(noVivo.map(function (x) { return Object.assign({}, x, { imei: imeiKey108_(x.imei), modulo: 'IMEI NO VIVO', acciones: '👁️ 📜 ✎️ ✕' }); }))
        .concat(stock.map(function (x) {
          var device = deviceByImei108_[imeiKey108_(x.imei)];
          return Object.assign({}, x, {
            imei: imeiKey108_(x.imei), modulo: 'STOCK ' + G108_(x.modelo), acciones: '👁️ 📜 ✎️ ✕',
            cuenta: (device && device.cuenta) ? device.cuenta : x.cuenta,
            estado: device ? (device.estado || device.estado_inventario) : (x.estado_inventario || x.estado),
            __device: device || null
          });
        }))
        .concat(incidents.map(function (x) { return Object.assign({}, x, { imei: imeiKey108_(x.imei || x.imei_original), modulo: 'INCIDENCIAS', responsable: x.responsable || x.nombre, acciones: '👁️ 📜 ✎️ ✕' }); }));
      var moduleOptions = Array.from(new Set(rows.map(function (x) { return x.modulo; }))).sort();
      document.querySelector('#app').innerHTML = '<section class="section"><div class="section-head"><h2>🔎 BUSCADOR</h2><button class="btn secondary" onclick="renderSearch()">🔄 ACTUALIZAR</button></div><div class="section-body"><div class="toolbar"><input id="v25-search-q" class="input search-field" placeholder="🔍 BUSCAR IMEI, NOMBRE, MODELO, DNI...">'
        + '<select id="v25-search-module" class="select"><option value="">MÓDULO</option>' + moduleOptions.map(function (m) { return '<option value="' + safe(m) + '">' + safe(m) + '</option>'; }).join('') + '</select>'
        + '</div></div><div id="v25-search-cards"></div><div id="v25-search-results"><div class="empty">ESCRIBE UN TÉRMINO PARA BUSCAR.</div></div></section>';
      var draw = function () {
        var qRaw = document.querySelector('#v25-search-q').value, q = N(qRaw), qDigits = qRaw.replace(/\D/g, ''), module = document.querySelector('#v25-search-module').value;
        var out = rows.filter(function (x) {
          if (module && x.modulo !== module) return false;
          if (!q) return true;
          if (qDigits && x.imei && x.imei.indexOf(qDigits) >= 0) return true;
          return Object.values(x).some(function (v) { return N(v).indexOf(q) >= 0; });
        });
        /* v111: pedido del usuario — más detalle en las tarjetas del primer resultado (antes
         * solo 6: módulo/imei/estado/cuenta/modelo/tipo). Estado con su color (badge). */
        document.querySelector('#v25-search-cards').innerHTML = q && out[0] ? '<div class="cards module-cards">'
          + card('📦 MÓDULO', out[0].modulo) + card('📱 IMEI', out[0].imei)
          + '<article class="metric"><strong>' + badge(out[0].estado || out[0].estado_proceso) + '</strong><span>ESTADO</span></article>'
          + card('📱 MARCA', out[0].marca || '—') + card('📱 MODELO', out[0].modelo || '—') + card('📋 TIPO', out[0].tipo || '—')
          + card('👤 RESPONSABLE', out[0].responsable || out[0].nombre || '—') + card('🪪 DNI', out[0].dni || '—') + card('💼 CARGO', out[0].cargo || '—')
          + card('👤 SUPERVISOR', out[0].supervisor || '—') + card('📍 ZONA', out[0].zona || '—') + card('🏢 CUENTA', out[0].cuenta || '—')
          + card('🗺️ DEPARTAMENTO', out[0].departamento || '—') + card('🏙️ CIUDAD', out[0].ciudad || '—') + card('🏪 TIENDA', out[0].tienda || '—')
          + card('📋 TIPO DE USO', out[0].tipo_uso || '—')
          + card('💰 MONTO S/', money(out[0].monto || out[0].valor)) + card('📅 F. ASIGNACIÓN', displayImportValue(out[0].fecha_asignacion || out[0].fecha_incidente, 'fecha_asignacion') || '—')
          + '</div>' : '';
        document.querySelector('#v25-search-results').innerHTML = q ? searchTable108_(out) : '<div class="empty">ESCRIBE UN TÉRMINO PARA BUSCAR.</div>';
        window.__searchRows = out;
        document.querySelectorAll('[data-search-act]').forEach(function (btn) {
          btn.onclick = function () {
            var row = out[Number(btn.dataset.searchIdx)];
            if (!row) return;
            searchRowAction_(row, btn.dataset.searchAct, function () { state.imeiNoVivo = null; renderSearch(); });
          };
        });
      };
      document.querySelector('#v25-search-q').oninput = draw;
      document.querySelector('#v25-search-module').oninput = draw;
    } catch (e) { errorView('No se pudo cargar Buscador', e, 'renderSearch'); }
  };

  /* ---------------------------------------------------------------------
   * 6) Historial IMEI: tarjetas ricas y dinámicas basadas en el registro
   *    MÁS RECIENTE de verdad (por fecha, no por posición en el array —
   *    LDU_Historial devuelve las filas en orden de inserción, y "más
   *    viejo primero" no es lo mismo que "rows[0]" si alguna vez se
   *    reordenan/filtran). Antes mostraba pocas tarjetas y a veces el
   *    estado del evento más antiguo ("SIN ESTADO").
   *    Se usa un MutationObserver puntual sobre #v36-hcards en vez de un
   *    wrap de una sola pasada: cuando se llega desde "Ver historial" con
   *    un IMEI precargado, la propia pantalla vuelve a dibujar sus
   *    tarjetas (más simples) al disparar la búsqueda automática — sin
   *    esto, esas tarjetas simples pisaban a las nuestras justo después.
   * ------------------------------------------------------------------- */
  function parseHistDate108_(v) {
    if (v instanceof Date) return v.getTime();
    var t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }
  var historyCardsObserver108_ = null, historyCardsHost108_ = null;
  function renderHistoryCards108_() {
    var rows = window.__historyRows || [];
    var host = document.querySelector('#v36-hcards');
    if (!host || !rows.length) return;
    var last = rows.slice().sort(function (a, b) { return parseHistDate108_(b.fecha) - parseHistDate108_(a.fecha); })[0];
    var html = '<div class="cards module-cards">'
      + card('📱 IMEI', last.imei) + card('📱 MARCA', last.marca || '—') + card('📱 MODELO', last.modelo || '—')
      + '<article class="metric"><strong>' + badge(last.estado || last.estado_proceso || last.estado_inventario) + '</strong><span>ESTADO</span></article>'
      + card('📅 ÚLTIMA ACCIÓN', last.accion || '—') + card('👤 USUARIO', last.usuario || '—')
      + card('👤 RESPONSABLE', last.responsable || last.nombre_completo || '—') + card('🪪 DNI', last.dni || '—') + card('💼 CARGO', last.cargo || '—')
      + card('👤 SUPERVISOR', last.supervisor || '—') + card('📍 ZONA', last.zona || '—') + card('🏢 CUENTA', last.cuenta || '—')
      + card('🗺️ DEPARTAMENTO', last.departamento || '—') + card('🏙️ CIUDAD', last.ciudad || '—') + card('🏪 TIENDA', last.tienda || '—')
      + card('📋 MODALIDAD', last.modalidad || '—') + card('💰 MONTO S/', money(last.monto || last.valor))
      + card('📅 FECHA', displayImportValue(last.fecha, 'fecha') || '—')
      + '</div>';
    if (historyCardsObserver108_) historyCardsObserver108_.disconnect();
    host.innerHTML = html;
    if (historyCardsObserver108_) historyCardsObserver108_.observe(host, { childList: true });
  }
  function ensureHistoryCardsObserver108_() {
    var host = document.querySelector('#v36-hcards');
    if (!host) { historyCardsHost108_ = null; return; }
    if (host === historyCardsHost108_) return;
    historyCardsHost108_ = host;
    if (historyCardsObserver108_) historyCardsObserver108_.disconnect();
    historyCardsObserver108_ = new MutationObserver(function () { renderHistoryCards108_(); });
    historyCardsObserver108_.observe(host, { childList: true });
    renderHistoryCards108_();
  }
  var appHostHistory108_ = document.querySelector('#app');
  if (appHostHistory108_) new MutationObserver(ensureHistoryCardsObserver108_).observe(appHostHistory108_, { childList: true });
  document.addEventListener('DOMContentLoaded', ensureHistoryCardsObserver108_);
  setTimeout(ensureHistoryCardsObserver108_, 300);
}());
