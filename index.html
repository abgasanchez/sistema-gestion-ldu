(function () {
  'use strict';

  const labels = new Map([
    ['Panel', '🏠 Dashboard'],
    ['Dashboard', '🏠 Dashboard'],
    ['Existencias', '📦 Stock'],
    ['IMEI histórico', '📋 Historial IMEI'],
    ['IMEI historico', '📋 Historial IMEI'],
  ]);

  function restoreMenu() {
    document.querySelectorAll('#main-nav a, #main-nav button').forEach((item) => {
      const current = item.textContent.replace(/\s+/g, ' ').trim();
      const restored = labels.get(current);
      if (restored && current !== restored) item.textContent = restored;
    });

    const title = document.getElementById('page-title');
    if (title && title.textContent.trim() === 'Panel') title.textContent = 'Dashboard';
  }

  function init() {
    restoreMenu();
    const observer = new MutationObserver(restoreMenu);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
