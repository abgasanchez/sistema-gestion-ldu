/* v106: mejoras solicitadas — Exportador General (Dashboard y Stock) en un solo archivo Excel
 * con varias hojas, y un reintento silencioso para lecturas ante fallas transitorias de Apps
 * Script (timeout/red), reduciendo los "No se pudo conectar con Apps Script" que se resuelven
 * solos en el segundo intento. No reemplaza ninguna función existente por completo: se apoya
 * en lo que ya expone el sistema (state, api, groupFor, exportRows, badge, money, safe,
 * displayImportValue, window.lduReconcile) y solo agrega HTML/botones nuevos vía DOM. */
(function () {
  'use strict';

  var N = function (v) { return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); };
  var I = function (v) { return String(v == null ? '' : v).replace(/\D/g, ''); };
  var G = function (m) { return typeof groupFor === 'function' ? groupFor(m) : 'INVENTARIO'; };

  /* v109: BUG — los exportadores confiaban en state.devices/state.stock/state.incidents ya
   * cargados en memoria por lo que sea que se haya renderizado antes (Dashboard o Stock), y
   * noVivoDevices() cacheaba el resultado de listImeiNoVivo INCLUSO CUANDO HABÍA FALLADO
   * (state.imeiNoVivo quedaba en [] tras un error transitorio, y como [] sigue siendo un
   * array, la comprobación "if (Array.isArray(...))" nunca volvía a intentar la llamada) —
   * cualquiera de los dos motivos deja una o más hojas del Excel vacías sin que haya pasado
   * nada raro con los datos reales del Sheet. Ahora ambos exportadores piden los 4 listados
   * DIRECTO al backend en el momento de exportar, sin depender de qué haya quedado en
   * memoria ni de un caché que pueda haberse quedado pegado en vacío. */
  async function fetchExportData_() {
    /* v110: BUG — Apps Script nunca "lanza" un error HTTP para un fallo de negocio (permiso,
     * hoja inexistente, etc.): siempre responde 200 con {status:'error', data:null, message}.
     * api() resuelve esa respuesta normalmente (no la rechaza), así que "r[i].data || []" la
     * convertía en un array vacío EN SILENCIO — el Excel salía "vacío" sin ningún aviso de que
     * en realidad hubo un error de backend (p. ej. LDU_IMEI_No_Vivo todavía no existe porque no
     * se corrió 'setup', o el rol de la sesión no tiene permiso). Ahora cada respuesta se
     * revisa explícitamente y, si alguna falló, se corta el export con un mensaje que dice
     * CUÁL falló y por qué, en vez de seguir con datos vacíos como si nada. */
    var labels = ['Inventario/Modelos A/B', 'Incidencias', 'Stock', 'IMEI NO VIVO'];
    var actions = ['listDevices', 'listIncidents', 'listStock', 'listImeiNoVivo'];
    var results = await Promise.all(actions.map(function (a) {
      return api(a).catch(function (e) { return { status: 'error', message: (e && e.message) || 'No se pudo conectar.' }; });
    }));
    var errors = [];
    results.forEach(function (r, i) { if (!r || r.status !== 'ok') errors.push(labels[i] + ' (' + actions[i] + '): ' + ((r && r.message) || 'sin respuesta válida')); });
    if (errors.length) throw new Error(errors.join(' | '));
    return { devices: results[0].data || [], incidents: results[1].data || [], stock: results[2].data || [], noVivo: results[3].data || [] };
  }

  /* ---------------------------------------------------------------------
   * 2) Exportador General — Dashboard (varias hojas en un solo Excel)
   * ------------------------------------------------------------------- */
  function buildSheetRows(rows, fields, getter) {
    getter = getter || function (r, k) { return r[k]; };
    return (rows || []).map(function (r) {
      var out = {};
      fields.forEach(function (f) { var v = displayImportValue(getter(r, f[0]), f[0]); out[f[1]] = v == null ? '' : v; });
      return out;
    });
  }
  /* Suma segura de monto/valor — usada por modelSummaryRows_ (la tabla de la hoja "Resumen
   * Dashboard", único lugar donde vive el cálculo agregado — ver v142 más abajo). */
  function moneyValue106_(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var s = String(v == null ? '' : v).replace(/[^0-9,.-]/g, ''); if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); else if (s.indexOf(',') >= 0) s = s.replace(',', '.'); var n = Number(s); return isFinite(n) ? n : 0; }
  /* v108: BUG — XLSX.utils.json_to_sheet([]) sobre un array vacío devuelve una hoja SIN
   * encabezados ni rango (`!ref`), que Excel muestra como una pestaña completamente en blanco
   * — parecía que "la hoja salía vacía" (por error) cuando en realidad solo no había filas para
   * ese grupo en ese momento. Ahora, sin filas, se arma la hoja con al menos la fila de
   * encabezados (mismos títulos que ve el usuario en pantalla), para que quede claro que la
   * hoja SÍ se generó pero no hay datos, no que algo se rompió. */
  /* v126: pedido del usuario — "formato de tabla, facilitando filtros y ordenamiento" también
   * en el Exportador General (Dashboard y Stock), no solo en exportRows (app.js). Se aplica
   * el mismo lduApplyTableFormat_ (AutoFilter + ancho de columna) a cada hoja de DATOS que
   * arma esta función — la hoja "Resumen Dashboard" queda fuera a propósito, no es una tabla
   * de filas sino un informe de tarjetas/etiquetas.
   * v142: pedido del usuario — el bloque de resumen (v141) se QUITA de estas hojas de detalle;
   * toda la información agregada/calculada debe vivir únicamente en "Resumen Dashboard", para
   * no tener dos lugares distintos calculando totales (y, como mostró el propio resumen, eso
   * además exhibió casos de estados sin estandarizar — ver _lduUppercaseSkipNormSet_, utils.gs). */
  function sheetFromRows(rows, fields, getter) {
    if (!rows || !rows.length) return XLSX.utils.aoa_to_sheet([fields.map(function (f) { return f[1]; })]);
    var data = buildSheetRows(rows, fields, getter);
    return (window.lduApplyTableFormat_ || function (ws) { return ws; })(XLSX.utils.json_to_sheet(data), data);
  }
  var INCIDENT_EXPORT_FIELDS_ = [
    ['imei_original', 'IMEI ORIGINAL'], ['tipo', 'TIPO'], ['imei_nuevo', 'IMEI NUEVO'],
    ['nombre_completo', 'NOMBRE COMPLETO'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['zona', 'ZONA'],
    ['supervisor', 'SUPERVISOR'], ['modelo', 'MODELO'], ['fecha_incidente', 'FECHA DEL INCIDENTE'],
    ['tipo_uso', 'TIPO USO'], ['valor', 'VALOR S/'], ['doc_autorizacion', 'DOC. AUTORIZACIÓN'],
    ['modalidad', 'MODALIDAD'], ['estado_proceso', 'ESTADO PROCESO'], ['documentos_adjuntos', 'DOCUMENTOS ADJUNTOS']
  ];
  /* v108: BUG — se leía r[f[0]] tal cual, pero varias columnas de Incidencias tienen alias
   * reales (nombre_completo puede venir como responsable/nombre, valor como monto, etc. —
   * mismo criterio que incidentValue98_ en active-fixes-v98.js) — sin esto, esas columnas
   * salían en blanco en el Excel aunque la fila sí tuviera el dato bajo el nombre alterno. */
  function incidentGetter_(r, k) {
    if (r[k] !== undefined && r[k] !== '') return r[k];
    if (k === 'nombre_completo') return r.responsable || r.nombre || '';
    if (k === 'documentos_adjuntos') return r.doc_adjunto || r.documentos || '';
    if (k === 'modalidad') return r.modality || '';
    if (k === 'estado_proceso') return r.estadoProceso || r.estadoproceso || '';
    if (k === 'valor') return r.monto || '';
    return '';
  }

  /* v108: hoja "Resumen Dashboard" rediseñada como un informe real (título, fecha de
   * generación, indicadores generales e una tabla de resumen por modelo combinando
   * Inventario/Modelos A/B contra Stock) en vez de una lista plana MÉTRICA/VALOR — pedido
   * explícito del usuario, con un ejemplo de formato como referencia.
   * v142: pedido del usuario — esta tabla debe tener EXACTAMENTE el mismo orden/columnas que
   * "📦 RESUMEN DE STOCK POR MODELO" (la tabla real del Dashboard en pantalla, función
   * summary() en active-fixes-v97.js — es la versión realmente activa, carga después que la
   * de este mismo archivo). Esa tabla cuenta sobre STOCK (no sobre Inventario) y cruza cada
   * fila de Stock contra su dispositivo asociado por IMEI para el estado; "FALTANTE" va al
   * final. Antes esta hoja tenía una columna "Total Inv." que no existe en la tabla de
   * referencia, y le faltaban "Almacén" y "Monto". */
  /* v143: pedido del usuario — "Y29S" y " Y29S" (espacio suelto) salían como dos filas
   * distintas con los mismos números: el backend ya normaliza MODELO al escribir (ver
   * normalizeModel_, normalizers.gs, ahora también aplicado en la importación masiva — ver
   * v143 en repository.gs/stock-service.gs/incident-service.gs), pero datos ya existentes
   * (de antes de ese fix) pueden seguir sucios hasta correr "Estandarizar formatos". Para que
   * el reporte no dependa de eso, se agrupa aquí por la MISMA normalización (recorte + espacios
   * colapsados + mayúsculas) en vez de por el valor crudo. */
  /* v145: pedido del usuario — "Y11" es "Y11 5G", "Y21" es "Y21 5G", "V25E" es "V25 E": no son
   * modelos distintos. El backend ya corrige esto al escribir (normalizeModel_, normalizers.gs)
   * y "Estandarizar formatos" lo repara en lo ya existente — esta misma tabla de alias se
   * replica aquí para que el resumen agrupe bien incluso antes de correr esa reparación. */
  var LDU_MODEL_ALIASES_143_ = { 'Y11': 'Y11 5G', 'Y21': 'Y21 5G', 'V25E': 'V25 E' };
  var MODEL_KEY_143_ = function (v) { var k = String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toUpperCase(); return LDU_MODEL_ALIASES_143_[k] || k; };
  function modelSummaryRows_() {
    var devices = state.devices || [], stock = state.stock || [];
    var deviceByImei = {}; devices.forEach(function (d) { var k = I(d.imei); if (k && !deviceByImei[k]) deviceByImei[k] = d; });
    var models = Array.from(new Set(stock.map(function (r) { return MODEL_KEY_143_(r.modelo); }).filter(Boolean))).sort();
    return models.map(function (model) {
      var st = stock.filter(function (s) { return MODEL_KEY_143_(s.modelo) === model; });
      var matched = st.filter(function (r) { return deviceByImei[I(r.imei)]; });
      var count = function (name) { return matched.filter(function (r) { var d = deviceByImei[I(r.imei)]; return N(d.estado) === N(name); }).length; };
      var monto = st.reduce(function (t, r) { return t + moneyValue106_(r.monto != null && r.monto !== '' ? r.monto : r.valor); }, 0);
      return [model, st.length, matched.length, count('Activo'), count('Almacén'), count('Dañado'), count('En Reparación'), count('Perdido'), count('Baja'), count('Pendiente Devolución'), count('Devuelto'), monto, Math.max(0, st.length - matched.length)];
    });
  }
  /* v116: BUG — esta hoja se armaba con totals(data.devices), es decir, pasando un array
   * explícito como "rows". Eso hace que window.totals() (ldu-v108-correcciones.js) entre por
   * la rama de sección/módulo (misma que usa cada "Estados — …"), NO por la rama GENERAL que
   * usa el propio Dashboard en vivo para sus tarjetas de arriba (esa rama solo se activa
   * llamando totals() SIN argumentos) — por eso "Total dispositivos"/"Faltante" del Excel no
   * coincidían con lo que se ve en pantalla (2102 vs 1835, 294 vs 355). Ahora se llama
   * totals() exactamente igual que el Dashboard, y la hoja muestra las MISMAS 13 tarjetas
   * generales, con las mismas etiquetas, en el mismo orden. */
  /* v144: pedido del usuario — "la hoja Resumen del Dashboard debe contener la misma
   * información de la página principal del Dashboard, con sus detalles, cuidando el cálculo".
   * El Dashboard en vivo (final-v23.js, window.renderDashboard) no es solo las 13 tarjetas
   * generales + Resumen por Modelo (lo único que esta hoja traía) — también muestra, EN ESTE
   * ORDEN: una sección "Estados — …" por cada módulo (Inventario LDU, Modelos A, Modelos B,
   * cada una con su propio desglose igual al de arriba pero acotado a ESE módulo) y el panel
   * de Incidencias con sus 14 tarjetas (window.lduIncidentCards, active-fixes-v98.js — mismos
   * datos que ve el módulo Incidencias). Se agregan ambos bloques aquí, con el mismo cálculo
   * (misma función totals(rows, group) que usa la pantalla, mismos campos que incidentGetter_
   * ya usa para la hoja Incidencias) para que nunca se desincronicen de lo que se ve en vivo. */
  function moduleStateRows_(title, group) {
    var rows = (state.devices || []).filter(function (d) { return G(d.modelo) === group; });
    var mt = (typeof totals === 'function') ? totals(rows, group) : {};
    return [
      [title],
      ['Stock', mt.stock || 0], ['Activos', mt.act || 0], ['Almacén', mt.alm || 0], ['Dañados', mt.dan || 0],
      ['En Reparación', mt.rep || 0], ['Perdidos', mt.per || 0], ['Baja', mt.baja || 0],
      ['Pendiente Devolución', mt.pdev || 0], ['Devueltos', mt.dev || 0], ['Faltante', mt.falt || 0],
      ['Valor', money(mt.valor || 0)],
      []
    ];
  }
  function incidentSummaryRows_(incidents) {
    var v = incidentGetter_, count = function (field, value) { return incidents.filter(function (r) { return N(v(r, field)) === N(value); }).length; };
    return [
      ['INCIDENCIAS — DETALLE (igual que el módulo Incidencias)'],
      ['Total', incidents.length],
      ['Pendientes', count('estado_proceso', 'Pendiente')],
      ['En Curso', count('estado_proceso', 'En Curso')],
      ['Finalizado', count('estado_proceso', 'Finalizado')],
      ['Descontado', count('estado_proceso', 'Descontado')],
      ['Daños', count('tipo', 'Daño')],
      ['Pérdidas', count('tipo', 'Pérdida')],
      ['Robos', count('tipo', 'Robo')],
      ['Otros (Tipo)', count('tipo', 'Otro')],
      ['Reposición', count('modalidad', 'Reposición')],
      ['Descuento', count('modalidad', 'Descuento')],
      ['Pago', count('modalidad', 'Pago')],
      ['Modalidad Pendiente', count('modalidad', 'Pendiente')],
      ['Sin Definir', incidents.filter(function (r) { var m = v(r, 'modalidad'); return !m || N(m) === N('Sin definir'); }).length],
      ['Valor Total', money(incidents.reduce(function (s, r) { return s + moneyValue106_(v(r, 'valor')); }, 0))],
      []
    ];
  }
  function buildResumenDashboardSheet_(incidents, t) {
    var rows = [
      ['INFORME DASHBOARD - SISTEMA LDU'],
      ['Generado:', new Date().toLocaleString('es-PE')],
      [],
      ['TARJETAS GENERALES (igual que el Dashboard)'],
      ['TOTAL STOCK', t.stock || 0],
      ['TOTAL ACTIVOS', t.act || 0],
      ['TOTAL EN ALMACÉN', t.alm || 0],
      ['TOTAL DAÑADOS', t.dan || 0],
      ['TOTAL EN REPARACIÓN', t.rep || 0],
      ['TOTAL PERDIDOS', t.per || 0],
      ['TOTAL EN BAJA', t.baja || 0],
      ['PENDIENTE DE DEVOLUCIÓN', t.pdev || 0],
      ['TOTAL DEVUELTOS', t.dev || 0],
      ['TOTAL FALTANTE', t.falt || 0],
      ['TOTAL IMEI NO INVENTARIO', t.noInv || 0],
      ['TOTAL IMEI NO VIVO', t.noVivoCount || 0],
      ['VALOR TOTAL', money(t.valor || 0)],
      ['Incidencias registradas', incidents.length],
      []
    ]
      .concat(moduleStateRows_('ESTADOS — 📱 INVENTARIO LDU', 'INVENTARIO'))
      .concat(moduleStateRows_('ESTADOS — 🟦 MODELOS ANTIGUOS A', 'A'))
      .concat(moduleStateRows_('ESTADOS — 🟧 MODELOS ANTIGUOS B', 'B'))
      .concat(incidentSummaryRows_(incidents))
      .concat([
        ['RESUMEN POR MODELO'],
        ['Modelo', 'Stock', 'En Inv.', 'Activos', 'Almacén', 'Dañados', 'Reparación', 'Perdidos', 'Baja', 'Pend.Dev', 'Devuelto', 'Monto S/', 'Faltante']
      ])
      .concat(modelSummaryRows_());
    var ws = XLSX.utils.aoa_to_sheet(rows);
    /* v126: la librería XLSX gratuita (sin el paquete "Pro") no permite pintar celdas ni
     * poner negrita — así que un diseño de "tarjetas" de colores como el del Dashboard en
     * pantalla no es posible sin agregar una dependencia de pago. Lo que sí se puede mejorar
     * sin eso: anchos de columna legibles y las filas de sección fusionadas en una sola celda
     * ancha, para que el informe se lea como un reporte con secciones, no una lista plana. */
    ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    /* v144: las filas de sección-título se fusionan A:D dinámicamente buscando el texto, en vez
     * de índices fijos — con bloques nuevos de tamaño variable (Incidencias, 3 módulos), fijar
     * números de fila a mano se habría desalineado en el primer cambio futuro. */
    var SECTION_TITLES_ = ['INFORME DASHBOARD - SISTEMA LDU', 'TARJETAS GENERALES (igual que el Dashboard)', 'RESUMEN POR MODELO', 'INCIDENCIAS — DETALLE (igual que el módulo Incidencias)'];
    ws['!merges'] = rows.reduce(function (merges, row, r) {
      if (row.length === 1 && (SECTION_TITLES_.indexOf(row[0]) >= 0 || /^ESTADOS — /.test(String(row[0] || '')))) merges.push({ s: { r: r, c: 0 }, e: { r: r, c: 3 } });
      return merges;
    }, []);
    return ws;
  }

  async function exportDashboardGeneral() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    var btn = document.querySelector('#ldu-export-general-dash');
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = '⏳ Generando...'; }
    try {
      var data = await fetchExportData_();
      state.devices = data.devices; state.incidents = data.incidents; state.stock = data.stock; state.imeiNoVivo = data.noVivo;
      var inventario = data.devices.filter(function (d) { return G(d.modelo) === 'INVENTARIO'; });
      var modelA = data.devices.filter(function (d) { return G(d.modelo) === 'A'; });
      var modelB = data.devices.filter(function (d) { return G(d.modelo) === 'B'; });
      /* v116: SIN argumentos — misma llamada exacta que hace el Dashboard en vivo para sus
       * tarjetas generales (ver renderDashboard(), final-v23.js + el wrap de totals() en
       * ldu-v108-correcciones.js). Pasar "devices" aquí era el bug (ver comentario arriba). */
      var t = (typeof totals === 'function') ? totals() : {};
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, buildResumenDashboardSheet_(data.incidents, t), 'Resumen Dashboard');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.devices, LDU_DEVICE_EXPORT_FIELDS), 'General');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(inventario, LDU_DEVICE_EXPORT_FIELDS), 'Inventario LDU');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.incidents, INCIDENT_EXPORT_FIELDS_, incidentGetter_), 'Incidencias');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(modelA, LDU_DEVICE_EXPORT_FIELDS), 'Modelos Ant. A');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(modelB, LDU_DEVICE_EXPORT_FIELDS), 'Modelos Ant. B');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.noVivo, LDU_DEVICE_EXPORT_FIELDS), 'IMEI NO VIVO');
      XLSX.writeFile(wb, 'LDU_Reporte_General.xlsx');
    } catch (e) {
      alert('No se pudo generar el Excel: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || '📊 Exportador General'; }
    }
  }
  window.exportDashboardGeneral = exportDashboardGeneral;

  function ensureDashboardExportButton() {
    var toolbar = document.querySelector('#app .dashboard-toolbar');
    if (!toolbar || toolbar.querySelector('#ldu-export-general-dash')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn secondary'; btn.id = 'ldu-export-general-dash';
    btn.textContent = '📊 Exportador General';
    btn.onclick = exportDashboardGeneral;
    toolbar.appendChild(btn);
  }

  /* ---------------------------------------------------------------------
   * 3) Exportador General — Stock (Stock Inventario/A/B + IMEI NO VIVO)
   * ------------------------------------------------------------------- */
  function stockGroup_(r) {
    var s = N(r.hoja_origen || r.source_sheet || '');
    if (s.indexOf('STOCK_A') >= 0) return 'A';
    if (s.indexOf('STOCK_B') >= 0) return 'B';
    return G(r.modelo);
  }
  async function exportStockGeneral() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    var btn = document.querySelector('#ldu-export-general-stock');
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = '⏳ Generando...'; }
    try {
      var data = await fetchExportData_();
      state.devices = data.devices; state.incidents = data.incidents; state.stock = data.stock; state.imeiNoVivo = data.noVivo;
      var reconciled = window.lduReconcile ? window.lduReconcile(data.devices, data.stock) : { deviceBy: {} };
      /* v112: la CUENTA que importa es la del dispositivo (CLARO/ENTEL/VIVO/RETAIL/OPEN
       * MARKET/etc.), no la columna propia de LDU_Stock — mismo criterio que la tabla del
       * módulo Stock (active-fixes-v98.js, CX()). */
      var mapped = data.stock.map(function (r) {
        var d = reconciled.deviceBy[I(r.imei)] || {};
        return Object.assign({}, r, {
          cuenta: (d.imei && d.cuenta) ? d.cuenta : r.cuenta,
          inventario: d.imei ? 'EN INVENTARIO' : 'NO EN INVENTARIO',
          estado: d.imei ? (d.estado || d.estado_inventario) : (r.estado_inventario || r.estado)
        });
      });
      var byGroup = function (g) { return mapped.filter(function (r) { return stockGroup_(r) === g; }); };
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('INVENTARIO'), LDU_STOCK_EXPORT_FIELDS), 'Stock Inventario');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('A'), LDU_STOCK_EXPORT_FIELDS), 'Stock Modelos A');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(byGroup('B'), LDU_STOCK_EXPORT_FIELDS), 'Stock Modelos B');
      XLSX.utils.book_append_sheet(wb, sheetFromRows(data.noVivo, LDU_DEVICE_EXPORT_FIELDS), 'IMEI NO VIVO');
      XLSX.writeFile(wb, 'LDU_Stock_Reporte_General.xlsx');
    } catch (e) {
      alert('No se pudo generar el Excel: ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || '📤 Exportador General'; }
    }
  }
  window.exportStockGeneral = exportStockGeneral;

  function ensureStockExportButton() {
    var head = document.querySelector('#app .stock-screen .section-head div');
    if (!head || head.querySelector('#ldu-export-general-stock')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn secondary'; btn.id = 'ldu-export-general-stock';
    btn.textContent = '📤 Exportador General';
    btn.onclick = exportStockGeneral;
    head.appendChild(btn);
  }

  /* ---------------------------------------------------------------------
   * 3b) v152: Reporte LDU filtrado — ventana propia con búsqueda y filtros
   *     (Zona, Supervisor, Cuenta, Tipo de uso, Estado) para exportar a Excel
   *     solo lo que se necesite, en vez de todo el Reporte General.
   * ------------------------------------------------------------------- */
  /* Pedido del usuario: "una herramienta que permita exportar el reporte de LDU por filtro de
   * zona, supervisor, cuenta, tipo de uso y estado, con su ventana, barra de búsqueda y
   * filtros". Es solo de LECTURA/exportación: no modifica ni elimina nada del inventario. Los
   * filtros son combinables (todos a la vez) y en cascada — cada desplegable solo ofrece los
   * valores que aún existen según la búsqueda y los demás filtros ya elegidos, así nunca se
   * llega a una combinación vacía por error. Las columnas del Excel son las mismas del reporte
   * de dispositivos del sistema (LDU_DEVICE_EXPORT_FIELDS), pasando por displayImportValue
   * (mayúsculas, IMEI como texto completo, fechas Perú) como el resto de exportadores. */
  var LDU_REPORT_FILTERS_ = [['zona', 'ZONA'], ['supervisor', 'SUPERVISOR'], ['cuenta', 'CUENTA'], ['tipo_uso', 'TIPO DE USO'], ['estado', 'ESTADO']];
  /* v158: pedido del usuario — la vista previa muestra TODAS las columnas del reporte (IMEI →
   * Estado), no solo un resumen. OBSERVACIONES no se muestra en pantalla pero sí viaja en el
   * Excel: este arreglo es solo la vista; lo exportado sale de LDU_DEVICE_EXPORT_FIELDS (las
   * mismas columnas que el Exportador General, observaciones incluida). */
  var LDU_REPORT_PREVIEW_COLS_ = [['imei', 'IMEI'], ['marca', 'MARCA'], ['modelo', 'MODELO'], ['n_linea', 'N° LÍNEA'], ['responsable', 'RESPONSABLE'], ['dni', 'DNI'], ['cargo', 'CARGO'], ['tipo', 'TIPO'], ['supervisor', 'SUPERVISOR'], ['zona', 'ZONA'], ['cuenta', 'CUENTA'], ['departamento', 'DEPARTAMENTO'], ['ciudad', 'CIUDAD'], ['canal', 'CANAL'], ['tienda', 'TIENDA'], ['tipo_uso', 'TIPO USO'], ['fecha_asignacion', 'F. ASIGNACIÓN'], ['monto', 'MONTO S/'], ['estado', 'ESTADO']];
  var LDU_REPORT_PREVIEW_MAX_ = 50;
  function reportValue_(r, k) { var v = k === 'estado' ? (r.estado || r.estado_inventario) : r[k]; return v == null ? '' : v; }
  function reportLabel_(k, v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (k === 'estado' && typeof lduStateLabel === 'function') return lduStateLabel(s);
    return s.toUpperCase();
  }
  async function openLduReportExport() {
    if (!window.XLSX) { alert('No se pudo cargar el exportador Excel.'); return; }
    if (document.querySelector('#ldu-report-window')) return;
    var drawer = document.createElement('div');
    drawer.className = 'drawer'; drawer.id = 'ldu-report-window';
    drawer.innerHTML = '<aside class="drawer-card" style="width:min(1000px,100%)"><div class="section-head"><h2>📤 Exportar Reporte LDU</h2><button class="btn secondary" data-lrx-close>✕</button></div><div class="loading">Cargando dispositivos...</div></aside>';
    document.body.appendChild(drawer);
    var card = drawer.querySelector('aside'), close = function () { drawer.remove(); };
    drawer.querySelector('[data-lrx-close]').onclick = close;
    var rows;
    try {
      var resp = await api('listDevices');
      if (!resp || resp.status !== 'ok') throw new Error((resp && resp.message) || 'No se pudo cargar el inventario.');
      rows = (resp.data || []).map(function (d) { var o = Object.assign({}, d); o.__blob = N(Object.keys(d).map(function (k) { return d[k]; }).join(' ')); return o; });
    } catch (e) {
      card.innerHTML = '<div class="section-head"><h2>📤 Exportar Reporte LDU</h2><button class="btn secondary" data-lrx-close>✕</button></div><div class="error">No se pudo cargar: ' + safe((e && e.message) || e) + '</div>';
      card.querySelector('[data-lrx-close]').onclick = close;
      return;
    }
    var selected = {}, labels = {};
    LDU_REPORT_FILTERS_.forEach(function (f) { selected[f[0]] = ''; labels[f[0]] = {}; });
    card.innerHTML = '<div class="section-head"><h2>📤 Exportar Reporte LDU</h2><button class="btn secondary" data-lrx-close>✕</button></div>'
      + '<div class="section-body"><div class="toolbar"><input id="lrx-q" class="input search-field" placeholder="🔍 Buscar IMEI, responsable, modelo, tienda..."></div>'
      + '<div class="toolbar">' + LDU_REPORT_FILTERS_.map(function (f) { return '<label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;color:var(--muted)">' + f[1] + '<select class="select" id="lrx-f-' + f[0] + '" style="min-width:150px;flex:none"></select></label>'; }).join('') + '</div>'
      + '<div class="toolbar"><strong id="lrx-count"></strong><span style="flex:1"></span><button class="btn secondary" id="lrx-clear">🧹 Limpiar filtros</button><button class="btn" id="lrx-export">📤 Exportar Excel</button></div>'
      + '<div class="table-wrap" id="lrx-table"></div><p class="muted" id="lrx-note"></p></div>';
    card.querySelector('[data-lrx-close]').onclick = close;
    var qInput = card.querySelector('#lrx-q');
    function matches(r, skip) {
      var q = N(qInput.value);
      if (q && r.__blob.indexOf(q) < 0) return false;
      return LDU_REPORT_FILTERS_.every(function (f) { var k = f[0]; return k === skip || !selected[k] || N(reportValue_(r, k)) === selected[k]; });
    }
    function refresh() {
      var out = rows.filter(function (r) { return matches(r, null); });
      LDU_REPORT_FILTERS_.forEach(function (f) {
        var k = f[0], pool = rows.filter(function (r) { return matches(r, k); }), seen = {};
        pool.forEach(function (r) { var raw = reportValue_(r, k), key = N(raw); if (key && !seen[key]) { seen[key] = reportLabel_(k, raw); } });
        if (selected[k] && !seen[selected[k]]) seen[selected[k]] = labels[k][selected[k]] || selected[k];
        Object.keys(seen).forEach(function (key) { labels[k][key] = seen[key]; });
        var keys = Object.keys(seen).sort(function (a, b) { return seen[a].localeCompare(seen[b]); });
        var el = card.querySelector('#lrx-f-' + k);
        el.innerHTML = '<option value="">TODOS</option>' + keys.map(function (key) { return '<option value="' + safe(key) + '">' + safe(seen[key]) + '</option>'; }).join('');
        el.value = selected[k];
      });
      card.querySelector('#lrx-count').textContent = out.length + ' de ' + rows.length + ' registros';
      var exportBtn = card.querySelector('#lrx-export');
      exportBtn.disabled = !out.length; exportBtn.textContent = '📤 Exportar Excel (' + out.length + ')';
      card.querySelector('#lrx-table').innerHTML = '<table><thead><tr>' + LDU_REPORT_PREVIEW_COLS_.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr></thead><tbody>'
        + (out.length ? out.slice(0, LDU_REPORT_PREVIEW_MAX_).map(function (r) { return '<tr>' + LDU_REPORT_PREVIEW_COLS_.map(function (c) { var v = reportValue_(r, c[0]); return '<td>' + safe(v === '' ? '—' : (c[0] === 'monto' ? money(v) : displayImportValue(v, c[0]))) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + LDU_REPORT_PREVIEW_COLS_.length + '" class="empty">Sin registros con esos filtros.</td></tr>')
        + '</tbody></table>';
      card.querySelector('#lrx-note').textContent = out.length > LDU_REPORT_PREVIEW_MAX_ ? 'Vista previa de los primeros ' + LDU_REPORT_PREVIEW_MAX_ + ' — el Excel incluye los ' + out.length + ' registros filtrados.' : '';
      return out;
    }
    var timer = null;
    qInput.oninput = function () { clearTimeout(timer); timer = setTimeout(refresh, 200); };
    LDU_REPORT_FILTERS_.forEach(function (f) { card.querySelector('#lrx-f-' + f[0]).onchange = function () { selected[f[0]] = this.value; refresh(); }; });
    card.querySelector('#lrx-clear').onclick = function () { qInput.value = ''; LDU_REPORT_FILTERS_.forEach(function (f) { selected[f[0]] = ''; }); refresh(); };
    card.querySelector('#lrx-export').onclick = function () {
      var out = refresh();
      if (!out.length) return;
      try {
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheetFromRows(out, LDU_DEVICE_EXPORT_FIELDS), 'Reporte LDU');
        var info = [['FILTROS APLICADOS'], ['Búsqueda', qInput.value.trim() || '(ninguna)']]
          .concat(LDU_REPORT_FILTERS_.map(function (f) { return [f[1], selected[f[0]] ? (labels[f[0]][selected[f[0]]] || selected[f[0]]) : 'TODOS']; }))
          .concat([['Registros exportados', out.length], ['Generado', new Date().toLocaleString('es-PE')]]);
        var wsInfo = XLSX.utils.aoa_to_sheet(info);
        wsInfo['!cols'] = [{ wch: 24 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Filtros');
        XLSX.writeFile(wb, 'LDU_Reporte_LDU_Filtrado.xlsx');
      } catch (e) { alert('No se pudo generar el Excel: ' + ((e && e.message) || e)); }
    };
    refresh();
    qInput.focus();
  }
  window.openLduReportExport = openLduReportExport;

  function ensureLduReportButton() {
    var toolbar = document.querySelector('#app .dashboard-toolbar');
    if (!toolbar || toolbar.querySelector('#ldu-report-filter-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn secondary'; btn.id = 'ldu-report-filter-btn';
    btn.textContent = '🔎 Reporte LDU filtrado';
    btn.onclick = openLduReportExport;
    toolbar.appendChild(btn);
  }

  /* ---------------------------------------------------------------------
   * 4) Enganche de UI: se re-evalúa cada vez que #app cambia de contenido
   *    completo (navegación/actualización), no en cada tecla de búsqueda.
   * ------------------------------------------------------------------- */
  function ensureExtraUi() {
    ensureDashboardExportButton();
    ensureLduReportButton();
    ensureStockExportButton();
  }
  var appHost = document.querySelector('#app');
  if (appHost) new MutationObserver(ensureExtraUi).observe(appHost, { childList: true });
  document.addEventListener('DOMContentLoaded', ensureExtraUi);
  setTimeout(ensureExtraUi, 300);

  /* ---------------------------------------------------------------------
   * 5) Estabilidad de conexión con Apps Script: un reintento silencioso
   *    para acciones de solo lectura cuando la falla es transitoria
   *    (timeout de 45s o corte de red), antes de mostrar el error al
   *    usuario. No se reintentan acciones de escritura (crear/editar/
   *    eliminar/importar) para no arriesgar una doble ejecución.
   * ------------------------------------------------------------------- */
  var RETRYABLE_READS_ = { health: 1, getSnapshot: 1, listDevices: 1, listStock: 1, listImeiNoVivo: 1, listIncidents: 1, listHistory: 1, listUsers: 1, listNotifications: 1, lookupImei: 1, getGrupo: 1, listDeleted: 1 };
  function isTransientError_(err) {
    var m = (err && err.message) || '';
    return /no respondi|No se pudo conectar|Failed to fetch|network|NetworkError/i.test(m);
  }
  var priorApi106_ = window.api;
  if (typeof priorApi106_ === 'function') {
    window.api = api = async function (action, payload) {
      try {
        return await priorApi106_(action, payload);
      } catch (err) {
        if (RETRYABLE_READS_[action] && isTransientError_(err)) {
          await new Promise(function (r) { setTimeout(r, 900); });
          return await priorApi106_(action, payload);
        }
        throw err;
      }
    };
  }
}());
