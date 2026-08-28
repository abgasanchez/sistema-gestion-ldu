function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
// Estados con color consistente en todos los módulos.
function badge(state){const value=String(state||'Sin estado'),key=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();const map={
  /* Dispositivo (RF-INV-002) */ ACTIVO:'green',ALMACEN:'blue',DANADO:'red','EN REPARACION':'yellow',PERDIDO:'purple',BAJA:'gray','PENDIENTE DEVOLUCION':'orange',DEVUELTO:'blue',
  /* Incidencia (RF-INC-004) */ PENDIENTE:'yellow','EN CURSO':'blue',FINALIZADO:'green',DESCONTADO:'gray',
  /* Stock */ 'EN INVENTARIO':'green','NO EN INVENTARIO':'red','IMEI NO VIVO':'purple',SI:'green',NO:'red','NO VIVO':'purple',
  'SIN RESPONSABLE':'gray','SIN ESTADO':'gray'
};return `<span class="badge ${map[key]||'gray'}">${esc(value)}</span>`}
function metric(label,value){return `<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`}
