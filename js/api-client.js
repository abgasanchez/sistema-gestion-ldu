const DEMO_DEVICES=[
  {device_id:'demo-1',imei:'862902089790913',marca:'VIVO',modelo:'V60 LITE',monto:1430,estado:'Activo',responsable:'FIGUERES SAMMIR',supervisor:'HENRY RUBIO',zona:'CENTRO 1',tienda:'Tienda demo'},
  {device_id:'demo-2',imei:'869584072141925',marca:'VIVO',modelo:'Y29S',monto:629,estado:'Dañado',responsable:'LUZ PATRICIA GUARDERAS',supervisor:'FRANK PAIVA',zona:'NORTE 4',tienda:'Tienda demo'},
  {device_id:'demo-3',imei:'863548069941411',marca:'VIVO',modelo:'Y36',monto:399,estado:'Devuelto',responsable:'FIGUERES SAMMIR',supervisor:'HENRY RUBIO',zona:'KAM',tienda:'Almacén'}
];
const DEMO_INCIDENTS=[{incident_id:'inc-1',imei_original:'869584072141925',tipo:'Daño',nombre:'LUZ PATRICIA GUARDERAS',modelo:'Y29S',valor:629,estado_proceso:'Pendiente'},{incident_id:'inc-2',imei_original:'862902089790913',tipo:'Pérdida',nombre:'COLABORADOR DEMO',modelo:'V60 LITE',valor:1430,estado_proceso:'Descontado'}];
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
function demoApi(action,payload){if(action==='listDevices'){const q=(payload.query||'').toLowerCase(),e=payload.estado||'';return Promise.resolve({status:'ok',data:DEMO_DEVICES.filter(d=>(!q||Object.values(d).join(' ').toLowerCase().includes(q))&&(!e||d.estado===e))})}if(action==='listIncidents')return Promise.resolve({status:'ok',data:DEMO_INCIDENTS});if(action==='createIncident'){const incident={...payload.incident,incident_id:'demo-'+Date.now(),estado_proceso:payload.incident.estado_proceso||'Pendiente'};DEMO_INCIDENTS.unshift(incident);return Promise.resolve({status:'ok',data:incident})}return Promise.resolve({status:'ok',data:null})}

// Cliente estable para GitHub Pages + Apps Script.
// Las lecturas usan JSONP para evitar el bloqueo CORS del redireccionamiento de Apps Script.
const LDU_JSONP_ACTIONS = new Set(['health','login','logout','listDevices','listIncidents','listStock','listHistory','lookupImei','getGrupo','setup','deleteDevice','listDeleted','listNotifications','sendNotification','listUsers','createUser','updateUser','deleteUser','clearSheet','createDevice','updateDevice','createIncident','importDeviceRow','importStockRow','importIncidentRow','importRows','importDevices','importStock','importIncidents','importarInventarioAuto','importarIncidencias','importarStock']);
const lduApiLegacy = api;
api = async function(action,payload={}){
  if(window.LDU_CONFIG.DEMO_MODE||!window.LDU_CONFIG.API_BASE_URL)return demoApi(action,payload);
  if(LDU_JSONP_ACTIONS.has(action)) return apiJsonp(action,payload);
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(window.LDU_CONFIG.API_BASE_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),redirect:'follow',signal:controller.signal,cache:'no-store'});
    if(!response.ok)throw new Error(`API HTTP ${response.status}`);
    return await response.json();
  }catch(error){
    if(error.name==='AbortError')throw new Error('La API no respondió en 45 segundos.');
    throw new Error(`No se pudo conectar con Apps Script: ${error.message}`);
  }finally{clearTimeout(timer)}
};
