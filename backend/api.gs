function _apiJson_(payload){var body=JSON.stringify(payload||{});if(typeof jsonResponse_==='function')return jsonResponse_(payload);return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);}
function _apiError_(message,code){return{status:'error',code:code||'REQUEST_ERROR',message:String(message||'Error de Apps Script.')}}
function doGet(e){var p=e&&e.parameter?e.parameter:{},cb=String(p.callback||''),r;try{r=handleRequest_(p);}catch(x){r=_apiError_(x&&x.message||x,'GET_ERROR');}if(cb&&/^[A-Za-z_$][\w$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+JSON.stringify(r||{})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return _apiJson_(r);}
function doPost(e){var b={};try{b=JSON.parse(e.postData&&e.postData.contents||'{}');}catch(x){return _apiJson_(_apiError_('JSON inválido.','INVALID_JSON'));}try{return _apiJson_(handleRequest_(b));}catch(x){return _apiJson_(_apiError_(x&&x.message||x,'POST_ERROR'));}}
function _apiParse_(p){['device','incident','row','rows','user','notification'].forEach(function(k){if(typeof p[k]==='string'){try{p[k]=JSON.parse(p[k]);}catch(e){p[k]=k==='rows'?[]:{};}}});return p;}
function _duplicateImei_(imei){var r=lookupImei({imei:imei}),d=r&&r.data||{};return d.device||d.stock||null;}
function _duplicateMessage_(imei,row){var group=row.grupo||'—',moduleName=row.modulo||row.source_sheet||'—';return 'El IMEI '+imei+' ya está registrado. Grupo: '+group+'. Modelo: '+(row.modelo||'—')+'. Monto: S/ '+Number(row.monto||row.valor||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'. Estado: '+(row.estado||row.estado_proceso||'—')+'. Módulo: '+moduleName+'.';}
function handleRequest_(request){try{var p=_apiParse_(request||{}),a=String(p.action||'health');
if(a==='health')return{status:'ok',data:{service:'ldu-api',time:new Date().toISOString()},message:'API operativa'};
if(a==='setup'){var setupResult=setupCanonicalSheets();try{_lduEnsureAuditSheet_();_lduNormalizeStockIds_();formatLduDates_();formatLduMoney_();}catch(dateError){}return setupResult;}
if(a==='formatDates')return formatLduDates_();
if(a==='formatMoney')return formatLduMoney_();
if(a==='login')return login(p);
if(a==='logout')return logout(p);
if(a==='ensureLduAdmin')return ensureLduAdmin(p);
if(a==='getMapaLduData')return getMapaLduData(p);
if(a==='getImeiSyncData')return getImeiSyncData(p);
if(a==='listDevices')return listDevices(p);
if(a==='listIncidents')return listIncidents(p);
if(a==='listStock')return listStock(p);
if(a==='listHistory'){try{_lduEnsureAuditSheet_();}catch(historySetupError){}return listHistory(p);}
if(a==='lookupImei')return lookupImei(p);
if(a==='getGrupo')return getGrupo(p);
if(a==='listUsers')return listUsers(p);
if(a==='listNotifications')return listNotifications(p);
if(a==='sendNotification')return sendNotification(p);
if(a==='listDeleted')return ok_(listDeleted_());
if(a==='createDevice'){var devicePayload=p.device||p,duplicateDevice=_duplicateImei_(devicePayload.imei);if(duplicateDevice)return fail_(_duplicateMessage_(devicePayload.imei,duplicateDevice),'DUPLICATE_IMEI');var cd=ok_(createDevice_(devicePayload,p.userId));try{_lduAuditImeiChange_('created',{},devicePayload,p.userId);}catch(auditCreateError){}clearLduReadCache_();return cd;}
if(a==='updateDevice'){var updatePayload=p.device||p,beforeDevice=_duplicateImei_(updatePayload.imei),ud=ok_(updateDevice_(updatePayload,p.userId));try{_lduAuditImeiChange_('updated',beforeDevice,updatePayload,p.userId);}catch(auditUpdateError){}clearLduReadCache_();return ud;}
if(a==='deleteDevice'){var dd=ok_(deleteDevice_(p.imei,p.userId));clearLduReadCache_();return dd;}
if(a==='createIncident'){var incidentPayload=p.incident||p,duplicateIncident=_duplicateImei_(incidentPayload.imei_original||incidentPayload.imei);if(duplicateIncident)return fail_(_duplicateMessage_(incidentPayload.imei_original||incidentPayload.imei,duplicateIncident),'DUPLICATE_IMEI');var ci=ok_(createIncident_(incidentPayload,p.userId));try{_lduAuditImeiChange_('incident_created',{},incidentPayload,p.userId);}catch(auditIncidentError){}clearLduReadCache_();return ci;}
if(a==='createUser')return ok_(createUser_(p.user||p,p.userId));
if(a==='updateUser')return ok_(updateUser_(p.user||p,p.userId));
if(a==='deleteUser')return ok_(deleteUser_(p.userIdTarget||p.user_id,p.userId));
if(a==='clearSheet')return clearSheet(p);
if(a==='importRows')return _apiImport_(p.module,p.rows||[],p.userId||'importacion',p.batchId||'');
if(a==='importDevices'||a==='importarInventarioAuto')return ok_(importDevices_(p.rows||p.devices||[],p.userId||p.usuario||'importacion'));
if(a==='importStock'||a==='importarStock')return ok_(importStock_(p.rows||[],p.userId||p.usuario||'importacion'));
if(a==='importIncidents'||a==='importarIncidencias')return ok_(importIncidents_(p.rows||[],p.userId||p.usuario||'importacion'));
if(a==='importDeviceRow')return ok_(importDevices_([p.row],p.userId||'importacion'));
if(a==='importStockRow')return ok_(importStock_([p.row],p.userId||'importacion'));
if(a==='importIncidentRow')return ok_(importIncidents_([p.row],p.userId||'importacion'));
return fail_('Acción no implementada: '+a,'NOT_IMPLEMENTED');}catch(e){return fail_(e.message||String(e),'REQUEST_ERROR');}}
function _apiImport_(module,rows,userId,batchId){module=Number(module);var props=PropertiesService.getScriptProperties(),cacheKey=batchId?'LDU_IMPORT_'+String(batchId).replace(/[^A-Za-z0-9_-]/g,'').slice(0,80):'',cached=cacheKey?props.getProperty(cacheKey):'';if(cached){try{return JSON.parse(cached);}catch(e){}}var lock=LockService.getScriptLock();try{lock.waitLock(30000);var result;if(module===1)result=ok_(importIncidents_(rows,userId));else if(module===2||module===3||module===4)result=ok_(importStock_(rows,userId));else result=ok_(importDevices_(rows,userId));clearLduReadCache_();if(cacheKey)props.setProperty(cacheKey,JSON.stringify(result));return result;}finally{try{lock.releaseLock();}catch(e){}}}
