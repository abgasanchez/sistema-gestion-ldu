function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
// Estados con color consistente en todos los módulos.
function badge(state){const value=String(state||'Sin estado'),key=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const map={ACTIVO:'green',ALMACEN:'blue',DANADO:'red','EN REPARACION':'purple',PERDIDO:'orange',BAJA:'black','PENDIENTE DEVOLUCION':'orange',DEVUELTO:'blue','SIN RESPONSABLE':'gray'};return `<span class="badge ${map[key]||'gray'}">${esc(value)}</span>`}
function badge(state){const map={Activo:'green',Dañado:'red','En Reparación':'orange',Perdido:'red',Baja:'gray','Pendiente Devolución':'orange',Devuelto:'blue'};return `<span class="badge ${map[state]||'gray'}">${esc(state||'Sin estado')}</span>`}
function metric(label,value){return `<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`}
