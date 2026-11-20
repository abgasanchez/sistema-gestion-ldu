(function(){
  'use strict';
  function text(v){return v==null?'':String(v).trim();}
  function profile(){
    var raw=window.currentUser||window.user||window.sessionUser||{};
    try{raw=JSON.parse(sessionStorage.getItem('ldu-session')||localStorage.getItem('lduUser')||localStorage.getItem('currentUser')||JSON.stringify(raw));}catch(ignore){}
    raw=raw&&raw.data?raw.data:raw;
    var name=text(raw.name||raw.nombre||raw.fullName||raw.nombreCompleto||raw.userName||raw.usuario);
    var role=text(raw.role||raw.rol||raw.userRole||raw.user_type||raw.perfil||raw.tipoUsuario);
    var footer=document.querySelector('.sidebar-footer');
    if(footer){footer.innerHTML='<div class="sidebar-profile"><b>👤 '+(name||role||'INVITADO').toUpperCase()+'</b>'+(name?'<small>'+(role||'INVITADO').toUpperCase()+'</small>':'')+'<button type="button" class="btn secondary sidebar-logout" id="ldu-logout-v96">↪ CERRAR SESIÓN</button></div><div>VERSIÓN MODULAR 1.0</div>';}
    var label=document.querySelector('.user-role,.sidebar-user-role,[data-user-role]');
    if(label)label.textContent=role||'INVITADO';
    var nameNode=document.querySelector('.user-name,[data-user-name]');
    if(nameNode)nameNode.textContent=name||'INVITADO';
    var logout=document.querySelector('#ldu-logout-v96,.logout-btn,[data-action="logout"],button[onclick*="logout"],button[onclick*="cerrarSesion"]');
    if(logout){logout.style.display='block';logout.style.visibility='visible';logout.style.opacity='1';}
  }
  function docs(){
    document.querySelectorAll('td').forEach(function(cell){
      var value=text(cell.textContent), link=cell.querySelector('a');
      if(link||!/^https?:\/\//i.test(value)||(!/drive\.google\.com/i.test(value)&&!/docs\.google\.com/i.test(value)))return;
      cell.textContent='';var a=document.createElement('a');a.href=value;a.target='_blank';a.rel='noopener noreferrer';a.textContent='📄 VER DOCUMENTO';a.className='document-link';cell.appendChild(a);
    });
  }
  document.addEventListener('DOMContentLoaded',function(){profile();docs();setTimeout(profile,800);setTimeout(profile,1800);setTimeout(docs,1200);});
  window.addEventListener('load',function(){profile();docs();});
})();
