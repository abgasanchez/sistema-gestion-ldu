function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
// Estados con color consistente en todos los módulos.
/* v109: pedido expl\u00edcito del usuario \u2014 TODOS los estados del sistema deben verse siempre en
 * MAY\u00daSCULAS, sin excepci\u00f3n (antes esta tabla usaba "Activo"/"Almac\u00e9n" en formato T\u00edtulo, que
 * ya era consistente entre s\u00ed pero no era lo pedido). badge() ya normalizaba "key" (sin
 * tildes, may\u00fasculas) para elegir el COLOR, pero mostraba el texto ORIGINAL (esc(value)) tal
 * cual ven\u00eda del dato \u2014 as\u00ed que "Activo", "ACTIVO" y "activo" sal\u00edan con el mismo color pero
 * cada uno con su propia may\u00fascula/min\u00fascula. Ahora, cuando el estado es uno reconocido, se
 * muestra siempre en MAY\u00daSCULAS (LDU_STATE_LABELS_ de abajo) sin importar c\u00f3mo est\u00e9 escrito en
 * la hoja; un valor no reconocido se muestra tal cual en may\u00fasculas tambi\u00e9n (toUpperCase()),
 * nunca en mixto. window.lduStateLabel() queda expuesto para que cualquier otro lugar del
 * frontend (desplegables de Stock/Incidencias, etc.) use la misma capitalizaci\u00f3n sin duplicar
 * esta tabla. */
const LDU_STATE_LABELS_ = {
  ACTIVO:'ACTIVO',ALMACEN:'ALMAC\u00c9N',DANADO:'DA\u00d1ADO','EN REPARACION':'EN REPARACI\u00d3N',PERDIDO:'PERDIDO',BAJA:'BAJA','PENDIENTE DEVOLUCION':'PENDIENTE DEVOLUCI\u00d3N',DEVUELTO:'DEVUELTO',
  PENDIENTE:'PENDIENTE','EN CURSO':'EN CURSO',FINALIZADO:'FINALIZADO',DESCONTADO:'DESCONTADO',
  'EN INVENTARIO':'EN INVENTARIO','NO EN INVENTARIO':'NO EN INVENTARIO','IMEI NO VIVO':'IMEI NO VIVO',SI:'S\u00cd',NO:'NO','NO VIVO':'NO VIVO',
  'SIN RESPONSABLE':'SIN RESPONSABLE','SIN ESTADO':'SIN ESTADO',
  DANO:'DA\u00d1O',PERDIDA:'P\u00c9RDIDA',ROBO:'ROBO',OTRO:'OTRO',
  REPOSICION:'REPOSICI\u00d3N',DESCUENTO:'DESCUENTO',PAGO:'PAGO','SIN DEFINIR':'SIN DEFINIR'
};
function lduStateKey_(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
function lduStateLabel(value){const v=String(value||'Sin estado'),key=lduStateKey_(v);return LDU_STATE_LABELS_[key]||v.toUpperCase();}
window.lduStateLabel=lduStateLabel;
function badge(state){const key=lduStateKey_(state||'Sin estado');const map={
  /* Dispositivo (RF-INV-002) */ ACTIVO:'green',ALMACEN:'blue',DANADO:'red','EN REPARACION':'yellow',PERDIDO:'purple',BAJA:'gray','PENDIENTE DEVOLUCION':'orange',DEVUELTO:'blue',
  /* Incidencia (RF-INC-004) */ PENDIENTE:'yellow','EN CURSO':'blue',FINALIZADO:'green',DESCONTADO:'gray',
  /* Stock */ 'EN INVENTARIO':'green','NO EN INVENTARIO':'red','IMEI NO VIVO':'purple',SI:'green',NO:'red','NO VIVO':'purple',
  'SIN RESPONSABLE':'gray','SIN ESTADO':'gray'
};return `<span class="badge ${map[key]||'gray'}">${esc(lduStateLabel(state))}</span>`}
function metric(label,value){return `<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`}
/* v119: pedido del usuario — el TIPO DE USO (Exhibición/Promotor/Red de Trabajo/Equipo en
 * Mano/Custodia, ver LDU_USES en app.js) debe verse con un color uniforme en todo el sistema,
 * igual criterio que badge() ya aplica a los estados. Reutiliza las mismas clases CSS
 * .badge (green/blue/red/yellow/purple/gray/orange) para no depender de estilos nuevos. */
const LDU_USE_LABELS_ = { EXHIBICION:'EXHIBICIÓN', PROMOTOR:'PROMOTOR', 'RED DE TRABAJO':'RED DE TRABAJO', 'EQUIPO EN MANO':'EQUIPO EN MANO', CUSTODIA:'CUSTODIA' };
function lduUseKey_(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();}
function lduUseLabel(value){const v=String(value||''),key=lduUseKey_(v);return v?(LDU_USE_LABELS_[key]||v.toUpperCase()):'';}
window.lduUseLabel=lduUseLabel;
function badgeTipoUso(value){if(value==null||value==='')return '';const key=lduUseKey_(value);const map={EXHIBICION:'purple',PROMOTOR:'blue','RED DE TRABAJO':'green','EQUIPO EN MANO':'orange',CUSTODIA:'yellow'};return `<span class="badge ${map[key]||'gray'}">${esc(lduUseLabel(value))}</span>`}
window.badgeTipoUso=badgeTipoUso;
