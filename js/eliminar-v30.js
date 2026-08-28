/* v30: módulo Eliminar estable. No depende de elementos creados por versiones anteriores.
 * v48: columnas exactas pedidas, filtros junto a la barra de búsqueda (mismo patrón que
 * Inventario/Stock: .toolbar con input + selects), más tarjetas informativas, y la
 * Justificación movida a un modal que solo aparece al pulsar "Eliminar seleccionados" (antes
 * era un input siempre visible mezclado con los filtros). */
(function(){
 'use strict';
 var esc=function(v){return safe(v==null?'':v);};
 var DELETE_FIELDS=[['imei','IMEI'],['marca','MARCA'],['modelo','MODELO'],['n_linea','N° LÍNEA'],['responsable','RESPONSABLE'],['dni','DNI'],['cargo','CARGO'],['tipo','TIPO'],['supervisor','SUPERVISOR'],['zona','ZONA'],['cuenta','CUENTA'],['departamento','DEPARTAMENTO'],['ciudad','CIUDAD'],['canal','CANAL'],['tienda','TIENDA'],['tipo_uso','TIPO USO'],['fecha_asignacion','F. ASIGNACIÓN'],['monto','MONTO S/'],['estado','ESTADO']];
 window.renderDelete=renderDelete=async function(){
  try{
   loading('Cargando Eliminar...');
   var rs=await Promise.all([api('listDevices'),api('listStock'),api('listIncidents'),api('listDeleted')]),rows=[],seen={};
   (rs[0].data||[]).forEach(function(x){var k=String(x.imei||'');if(k&&!seen[k]){seen[k]=1;rows.push(Object.assign({},x,{modulo:typeof groupFor==='function'?(groupFor(x.modelo)==='A'?'Modelos Ant. A':groupFor(x.modelo)==='B'?'Modelos Ant. B':'Inventario LDU'):'Inventario LDU'}));}});
   (rs[1].data||[]).forEach(function(x){var k=String(x.imei||'');if(k&&!seen[k]){seen[k]=1;rows.push(Object.assign({},x,{modulo:'Stock'}));}});
   (rs[2].data||[]).forEach(function(x){var k=String(x.imei||x.imei_original||'');if(k&&!seen[k]){seen[k]=1;rows.push(Object.assign({},x,{imei:k,modulo:'Incidencias',responsable:x.responsable||x.nombre}));}});
   var selected=new Set(),page=1,size=20,app=document.querySelector('#app');
   var moneyOf=function(x){return Number(x.monto||x.valor||0);};
   var totalValue=rows.reduce(function(t,x){return t+moneyOf(x);},0);
   var byModule={};rows.forEach(function(x){byModule[x.modulo]=(byModule[x.modulo]||0)+1;});
   var cardsHtml='<div class="cards compact v30-cards">'
     +'<div class="metric"><strong>'+rows.length+'</strong><span>📊 REGISTROS</span></div>'
     +'<div class="metric"><strong>0</strong><span>☑️ SELECCIONADOS</span></div>'
     +'<div class="metric"><strong>'+(byModule['Inventario LDU']||0)+'</strong><span>📱 INVENTARIO LDU</span></div>'
     +'<div class="metric"><strong>'+(byModule['Modelos Ant. A']||0)+'</strong><span>🟦 MODELOS ANT. A</span></div>'
     +'<div class="metric"><strong>'+(byModule['Modelos Ant. B']||0)+'</strong><span>🟧 MODELOS ANT. B</span></div>'
     +'<div class="metric"><strong>'+(byModule['Stock']||0)+'</strong><span>📦 STOCK</span></div>'
     +'<div class="metric"><strong>'+(byModule['Incidencias']||0)+'</strong><span>⚠️ INCIDENCIAS</span></div>'
     +'<div class="metric"><strong>'+new Set(rows.map(function(x){return x.estado;}).filter(Boolean)).size+'</strong><span>🏷️ ESTADOS DISTINTOS</span></div>'
     +'<div class="metric"><strong>'+money(totalValue)+'</strong><span>💰 VALOR TOTAL</span></div>'
     +'</div>';
   app.innerHTML='<section class="section v30-delete"><div class="section-head"><h2>🗑️ Eliminar</h2><div><button class="btn secondary" id="v30-refresh">🔄 Actualizar</button><button class="btn secondary" id="v30-all">☑️ Seleccionar página</button><button class="btn danger" id="v30-delete">🗑️ Eliminar seleccionados</button></div></div>'+cardsHtml+'<div class="toolbar"><input id="v30-q" class="input search-field" placeholder="🔍 Buscar IMEI, responsable, zona...">'
     +'<select id="v30-model" class="select"><option value="">MODELO</option></select>'
     +'<select id="v30-module" class="select"><option value="">MÓDULO</option><option>Inventario LDU</option><option>Modelos Ant. A</option><option>Modelos Ant. B</option><option>Stock</option><option>Incidencias</option></select>'
     +'<select id="v30-state" class="select"><option value="">ESTADO</option>'+LDU_STATES.map(function(x){return'<option>'+esc(x)+'</option>';}).join('')+'</select>'
     +'</div><div id="v30-results"></div><div id="v30-pager"></div></section><section class="section"><div class="section-head"><h2>📋 Historial de eliminaciones</h2></div>'+table(rs[3].data||[],['eliminado_en','eliminado_por','imei','modulo','motivo'])+'</section>';
   var model=document.querySelector('#v30-model');Array.from(new Set(rows.map(function(x){return x.modelo;}).filter(Boolean))).sort().forEach(function(x){model.insertAdjacentHTML('beforeend','<option>'+esc(x)+'</option>');});
   var updateSelectedCard=function(){var n=document.querySelector('.v30-cards .metric:nth-child(2) strong');if(n)n.textContent=selected.size;};
   var draw=function(){var q=norm(document.querySelector('#v30-q').value),mo=model.value,md=document.querySelector('#v30-module').value,st=document.querySelector('#v30-state').value,out=rows.filter(function(x){return(!q||Object.values(x).some(function(v){return norm(v).indexOf(q)>=0;}))&&(!mo||x.modelo===mo)&&(!md||x.modulo===md)&&(!st||norm(x.estado)===norm(st));}),pages=Math.max(1,Math.ceil(out.length/size));page=Math.min(page,pages);var view=out.slice((page-1)*size,page*size),host=document.querySelector('#v30-results');host.innerHTML='<div class="table-wrap module-table"><table><thead><tr><th>✓</th>'+DELETE_FIELDS.map(function(f){return'<th>'+f[1]+'</th>';}).join('')+'</tr></thead><tbody>'+(view.map(function(x){return'<tr><td><input type="checkbox" data-v30-imei="'+esc(x.imei)+'" '+(selected.has(String(x.imei))?'checked':'')+'></td>'+DELETE_FIELDS.map(function(f){var k=f[0];if(k==='monto')return'<td>'+esc(money(moneyOf(x)))+'</td>';if(k==='estado')return'<td>'+badge(x.estado||x.estado_proceso)+'</td>';return'<td>'+esc(displayImportValue(x[k],k))+'</td>';}).join('')+'</tr>';}).join('')||'<tr><td colspan="'+(DELETE_FIELDS.length+1)+'" class="empty">Sin registros</td></tr>')+'</tbody></table></div>';host.querySelectorAll('[data-v30-imei]').forEach(function(c){c.onchange=function(){c.checked?selected.add(c.dataset.v30Imei):selected.delete(c.dataset.v30Imei);updateSelectedCard();};});if(window.lduRenderPager)window.lduRenderPager(document.querySelector('#v30-pager'),page,out.length,size,function(p){page=p;draw();});};
   ['v30-q','v30-model','v30-module','v30-state'].forEach(function(id){var el=document.querySelector('#'+id);if(el)el.oninput=function(){page=1;draw();};});
   var refresh=document.querySelector('#v30-refresh');if(refresh)refresh.onclick=window.renderDelete;
   var all=document.querySelector('#v30-all');if(all)all.onclick=function(){document.querySelectorAll('#v30-results [data-v30-imei]').forEach(function(c){c.checked=true;selected.add(c.dataset.v30Imei);});updateSelectedCard();};
   var del=document.querySelector('#v30-delete');if(del)del.onclick=function(){
     if(!selected.size)return alert('Selecciona al menos un registro.');
     var modal=document.createElement('div');modal.className='drawer';
     modal.innerHTML='<aside class="drawer-card v26-confirm-card"><div class="section-head"><h2>⚠️ Confirmación de eliminación</h2><button class="btn secondary" id="v30-modal-x">✕</button></div><p>Se eliminarán <b>'+selected.size+'</b> registro'+(selected.size===1?'':'s')+'. Esta acción no se puede deshacer.</p><label>Justificación de la eliminación:</label><textarea id="v30-reason" class="input" rows="4" required></textarea><div class="form-actions"><button class="btn secondary" id="v30-modal-cancel">Cancelar</button><button class="btn danger" id="v30-modal-confirm">Confirmar eliminación</button></div></aside>';
     document.body.appendChild(modal);
     var close=function(){modal.remove();};
     modal.querySelector('#v30-modal-x').onclick=close;modal.querySelector('#v30-modal-cancel').onclick=close;
     modal.querySelector('#v30-modal-confirm').onclick=async function(){
       var reason=modal.querySelector('#v30-reason').value.trim();
       if(!reason)return alert('La justificación es obligatoria.');
       var button=this;button.disabled=true;
       for(var imei of selected)await api('deleteDevice',{imei:imei,justification:reason,userId:'web-user'});
       close();renderDelete();
     };
   };
   draw();
  }catch(e){errorView('No se pudo cargar Eliminar',e,'renderDelete');}
 };
 var st=document.createElement('style');st.textContent='.v30-cards{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:10px;margin:14px 0}.v30-delete .table-wrap{margin-top:0}.v30-delete .toolbar{margin-bottom:0}@media(max-width:900px){.v30-cards{grid-template-columns:repeat(2,1fr)}}';document.head.appendChild(st);
}());
