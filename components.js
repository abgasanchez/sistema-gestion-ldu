function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function badge(state){const map={Activo:'green',Dañado:'red','En Reparación':'orange',Perdido:'red',Baja:'gray','Pendiente Devolución':'orange',Devuelto:'blue'};return `<span class="badge ${map[state]||'gray'}">${esc(state||'Sin estado')}</span>`}
function metric(label,value){return `<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`}
