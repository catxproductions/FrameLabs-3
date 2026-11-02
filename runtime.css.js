(function () {
  const rules = `
    .hidden { display: none !important; }
    .reveal { opacity: 0; transform: translateY(18px); transition: opacity .55s ease, transform .55s ease; }
    .reveal.visible { opacity: 1; transform: none; }
    .world-preview { position: relative; overflow: hidden; background: var(--scene-base, #141d3b); }
    .world-preview canvas { display: block; width: 100%; height: 100%; min-height: 170px; border-radius: inherit; }
    .environment-list .env-item { width: 100%; text-align: left; color: inherit; font: inherit; cursor: pointer; }
    [data-action].active, #toggleAuto.active { border-color: rgba(92,231,212,.55); background: rgba(92,231,212,.12); }
    button:focus-visible, a:focus-visible, .env-item:focus-visible { outline: 2px solid #5ce7d4; outline-offset: 3px; }
    button:disabled { opacity: .6; cursor: wait; }
    #dashboardScreen { overflow-y: auto; align-items: start; }
    .dashboard { min-height: 100vh; }
    .dashboard-grid { padding-bottom: 1rem; }
    @media (max-width: 700px) { .settings-grid { grid-template-columns: 1fr; } }
  `;
  const style = document.createElement('style');
  style.textContent = rules;
  document.head.appendChild(style);
})();
