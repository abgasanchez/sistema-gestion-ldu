const DEMO_DEVICES=[
  {id_dispositivo:'demo-1',imei:'862902089790913',marca:'VIVO',modelo:'V60 LITE',monto:1430,estado:'Activo',responsable:'FIGUERES SAMMIR',supervisor:'HENRY RUBIO',zona:'CENTRO 1',tienda:'Tienda demo'},
  {id_dispositivo:'demo-2',imei:'869584072141925',amarca:'VIVO',modelo:'Y29S',monto:629,estado:'Dañado',responsable:'LUZ PATRICIA GUARDERAS',supervisor:'FRANK PAIVA',zona:'NORTE 4',tienda:'Tienda demo'},
  {id_dispositivo:'demo-3',imei:'863548069941411',marca:'VIVO',modelo:'Y36',monto:399,estado:'Devuelto',responsable:'FIGUERES SAMMIR',supervisor:'HENRY RUBIO',zona:'KAM',tienda:'Almacén'}
];
const DEMO_INCIDENTS=[{id_incidencia:'inc-1',imei_original:'869584072141925',tipo:'Daño',nombre:'LUZ PATRICIA GUARDERAS',modelo:'Y29S',valor:629,estado_proceso:'Pendiente'},{id_incidencia:'inc-2',imei_original:'862902089790913',tipo:'Pérdida',nombre:'COLABORADOR DEMO',modelo:'V60 LITE',valor:1430,estado_proceso:'Descontado'}];
async function api(action,payload={}){
  if(window.LDU_CONFIG.DEMO_MODE||!window.LDU_CONFIG.API_BASE_URL)return demoApi(action,payload);
  if(action==='listDevices'||action==='listIncidents')return apiJsonp(action,payload);
  const params=new URLSearchParams({action,...payload});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(`${window.LDU_CONFIG.API_BASE_URL}?${params.toString()}`,{method:'GET',redirect:'follow',signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(`API HTTP ${response.status}`);
    return await response.json();
  }catch(error){
    if(error.name==='AbortError')throw new Error('La API no respondió en 45 segundos.');
    throw new Error(`No se pudo conectar con Apps Script: ${error.message}`);
  }finally{clearTimeout(timer)}
}

function apiJsonp(action,payload={}){
  return new Promise((resolve,reject)=>{
    const callbackName=`lduCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script=document.createElement('script');
    const serialized={action,callback:callbackName};
    Object.keys(payload||{}).forEach(key=>{const value=payload[key];serialized[key]=value&&typeof value==='object'?JSON.stringify(value):String(value??'')});
    const params=new URLSearchParams(serialized);
    const timer=setTimeout(()=>{cleanup();reject(new Error('Apps Script no respondió en 45 segundos.'))},45000);
    function cleanup(){clearTimeout(timer);delete window[callbackName];script.remove()}
    window[callbackName]=data=>{cleanup();resolve(data)};
    script.onerror=()=>{cleanup();reject(new Error('No se pudo cargar la respuesta de Apps Script.'))};
    script.src=`${window.LDU_CONFIG.API_BASE_URL}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

function demoApi(action,payload){if(action==='listDevices'){const q=(payload.query||'').toLowerCase(),e=payload.estado||'';return Promise.resolve({status:'ok',data:DEMO_DEVICES.filter(d=>(!q||Object.values(d).join(' ').toLowerCase().includes(q))&&(!e||d.estado===e))})}if(action==='listIncidents')return Promise.resolve({status:'ok',data:DEMO_INCIDENTS});if(action==='createIncident'){const incident={...payload.incident,id_incidencia:'demo-'+Date.now(),estado_proceso:payload.incident.estado_proceso||'Pendiente'};DEMO_INCIDENTS.unshift(incident);return Promise.resolve({status:'ok',data:incident})}return Promise.resolve({status:'ok',data:null})}

// Cliente estable para GitHub Pages + Apps Script.
// Las lecturas usan JSONP para evitar el bloqueo CORS del redireccionamiento de Apps Script.
const LDU_JSONP_ACTIONS = new Set(['health','login','logout','getSnapshot','listDevices','listIncidents','listStock','listHistory','lookupImei','getGrupo','setup','deleteDevice','listDeleted','listNotifications','sendNotification','listUsers','createUser','updateUser','deleteUser','clearSheet','createDevice','updateDevice','createIncident','importDeviceRow','importStockRow','importIncidentRow','importDevices','importStock','importIncidents','importarInventarioAuto','importarIncidencias','importarStock']);
const lduApiLegacy = api;
api = async function(action,payload={}){
  if(window.LDU_CONFIG.DEMO_MODE||!window.LDU_CONFIG.API_BASE_URL)return demoApi(action,payload);
  if(action==='importRows'){
    const safePayload=Object.assign({batchId:'import-'+Date.now()+'-'+Math.random().toString(36).slice(2)},payload);
    try{return await apiPostRequest(action,safePayload)}catch(postError){
      try{return await apiJsonp(action,safePayload)}catch(jsonpError){throw new Error('No se pudo completar la importación: '+jsonpError.message)}
    }
  }
  if(LDU_JSONP_ACTIONS.has(action)) return apiJsonp(action,payload);
  return apiPostRequest(action,payload);
};
async function apiPostRequest(action,payload={}){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(window.LDU_CONFIG.API_BASE_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),redirect:'follow',signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(`API HTTP ${response.status}`);
    return await response.json();
  }catch(error){
    if(error.name==='AbortError')throw new Error('La API no respondió en 45 segundos.');
    throw new Error(`No se pudo conectar con Apps Script: ${error.message}`);
  }finally{clearTimeout(timer)}
}
/* v57: fallback de importación para despliegues Apps Script anteriores. */
const lduApiBeforeImportFallback = api;
api = async function (action, payload = {}) {
  if (action !== 'importRows' || window.LDU_CONFIG.DEMO_MODE || !window.LDU_CONFIG.API_BASE_URL) return lduApiBeforeImportFallback(action, payload);
  try {
    const response = await lduApiBeforeImportFallback(action, payload);
    const responseData = response && response.data || {};
    const hasRowFailures = Number(responseData.errorCount || responseData.errorsCount || 0) > 0 || (Array.isArray(responseData.rejectedRows) && responseData.rejectedRows.length > 0);
    if (response && response.status === 'ok' && !hasRowFailures) return response;
    throw new Error(response && response.message || 'Apps Script rechazó importRows.');
  } catch (primaryError) {
    const module = Number(payload.module), legacyAction = module === 1 ? 'importIncidents' : module >= 2 ? 'importStock' : 'importDevices';
    const fallbackPayload = Object.assign({}, payload, { rows: Array.isArray(payload.rows) ? payload.rows : [] });
    try { return await apiPostRequest(legacyAction, fallbackPayload); }
    catch (postError) {
      try { return await apiJsonp(legacyAction, fallbackPayload); }
      catch (jsonpError) { throw new Error('No se pudo importar el lote. Principal: ' + primaryError.message + '. Fallback: ' + jsonpError.message); }
    }
  }
};

/* v64: importación única. No reenviar un lote al importador legado cuando
 * Apps Script devuelve filas rechazadas; ese reintento desalineaba columnas. */
const lduApiStableImportV64 = api;
api = async function (action, payload = {}) {
  if (action !== 'importRows' || window.LDU_CONFIG.DEMO_MODE || !window.LDU_CONFIG.API_BASE_URL) {
    return lduApiStableImportV64(action, payload);
  }
  try {
    return await apiPostRequest(action, payload);
  } catch (postError) {
    try {
      return await apiJsonp(action, payload);
    } catch (jsonpError) {
      throw new Error('No se pudo importar el lote. POST: ' + postError.message + '. JSONP: ' + jsonpError.message);
    }
  }
};
