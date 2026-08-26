/* v74: verifica lotes sin respuesta y muestra IMEI realmente faltantes. */
(function(){
  'use strict';
  function key(v){return String(v==null?'':v).trim().replace(/[\u00a0\s]/g,'').replace(/\.0+$/,'').replace(/\D/g,'');}
  var basePreview=window.previewImport;
  window.previewImport=async function(file,module,card){
    var pending=[],baseApi=window.api;
    window.api=async function(action,payload){if(action!=='importRows')return baseApi(action,payload);try{return await baseApi(action,payload);}catch(error){(payload&&payload.rows||[]).forEach(function(row){pending.push(row);});throw error;}};
    try{await basePreview(file,module,card);}finally{window.api=baseApi;}
    if(!pending.length)return;
    var host=document.querySelector('[data-i70-result]')||document.querySelector('#import-result');if(!host)return;
    var missing=[],confirmed=[],lookupError='';
    try{var response=await baseApi('listDevices'),serverRows=response&&response.data||[],server={};serverRows.forEach(function(row){var id=key(row.imei||row.IMEI||row.imei_original);if(id)server[id]=true;});pending.forEach(function(row){var id=key(row.imei||row.imei_original);(server[id]?confirmed:missing).push({imei:id,row:row});});}catch(error){lookupError=error.message||'No se pudo verificar las hojas';pending.forEach(function(row){missing.push({imei:key(row.imei||row.imei_original),row:row});});}
    var section=document.createElement('section');section.className='v74-import-report';section.innerHTML='<hr><strong>Verificación de lotes sin respuesta</strong><p>'+(lookupError?'No se pudo consultar nuevamente Apps Script. Los siguientes IMEI quedan <b>sin confirmar</b>:':'De los lotes sin respuesta: <b>'+confirmed.length+'</b> ya aparecen en las hojas y <b>'+missing.length+'</b> no aparecen.')+'</p>';
    if(missing.length){var list=missing.map(function(x){return x.imei;}).join('\n');section.innerHTML+='<p><b>IMEI faltantes/sin confirmar ('+missing.length+'):</b></p><textarea readonly rows="8" style="width:100%;box-sizing:border-box">'+list+'</textarea><button type="button" class="btn secondary" data-v74-download>⬇️ Descargar IMEI faltantes</button>';section.querySelector('[data-v74-download]').onclick=function(){var blob=new Blob([list+'\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='imei-faltantes-importacion.txt';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);};}else if(!lookupError)section.innerHTML+='<p>✅ No hay IMEI faltantes. El problema fue únicamente la confirmación de respuesta.</p>';host.appendChild(section);
  };
}());
