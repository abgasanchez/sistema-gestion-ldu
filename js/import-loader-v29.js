/* v29: carga tolerante de SheetJS para que importar no dependa de un solo CDN. */
(function(){
 'use strict';
 var sources=['https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];
 function load(i){if(window.XLSX)return Promise.resolve(window.XLSX);if(i>=sources.length)return Promise.reject(new Error('No se pudo cargar el motor XLSX. Verifica internet o agrega el archivo XLSX localmente.'));return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=sources[i];s.async=true;s.onload=function(){window.XLSX?resolve(window.XLSX):load(i+1).then(resolve,reject);};s.onerror=function(){load(i+1).then(resolve,reject);};document.head.appendChild(s);});}
 var base=window.previewImport;window.previewImport=async function(file,module,host){try{await load(0);return base(file,module,host);}catch(e){var m=host&&host.querySelector('[data-v28-msg]');if(m)m.textContent='❌ '+e.message;else if(host)host.textContent='❌ '+e.message;else alert(e.message);}};
 window.ensureXlsx=load;
}());
