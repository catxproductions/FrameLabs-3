(function () {
  const environmentColors = {
    Skyline: ['#141d3b', '#64baff', '#67f2dc'],
    Tundra: ['#172a3d', '#a8ddff', '#d2f3ff'],
    Abyss: ['#091a2c', '#568bff', '#69e0d1']
  };

  function renderDashboard() {
    const model = window.FrameLabs3State.state;
    const { runtime, settings } = model;
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = String(value);
    };

    set('#dashboardScreen .hud-metrics div:nth-child(1) strong', `${runtime.latency.toFixed(runtime.latency < 10 ? 1 : 0)}ms`);
    set('#dashboardScreen .hud-metrics div:nth-child(2) strong', runtime.fps);
    set('#dashboardScreen .hud-metrics div:nth-child(3) strong', `${runtime.load}%`);
    set('#dashboardScreen .hero-panel-copy h2', `${runtime.environment} Nexus`);

    const description = document.querySelector('#dashboardScreen .hero-panel-copy p');
    if (description) description.textContent = `${runtime.agents} autonomous agents are interacting in a browser-based ${settings.realism.toLowerCase()} environment. Simulation time: ${runtime.elapsed.toFixed(1)}s.`;

    const stats = document.querySelectorAll('#dashboardScreen .panel-metric strong');
    if (stats.length >= 4) {
      stats[0].textContent = `${runtime.energy}%`;
      stats[1].textContent = `${runtime.integrity.toFixed(1)}%`;
      stats[2].textContent = runtime.signal;
      stats[3].textContent = runtime.threat;
    }

    const telemetry = document.querySelectorAll('#dashboardScreen .telemetry strong');
    if (telemetry.length >= 3) {
      telemetry[0].textContent = `${Math.round(34 + runtime.load * 0.42)}°`;
      telemetry[1].textContent = `${runtime.agents} agents`;
      telemetry[2].textContent = `${runtime.scans} scans`;
    }

    const rows = document.querySelectorAll('#dashboardScreen .status-list .dot-row');
    if (rows.length >= 3) {
      rows[0].textContent = `${settings.mode} browser runtime`;
      rows[1].textContent = `${runtime.environment} scene active`;
      rows[2].textContent = runtime.status;
    }

    document.querySelectorAll('.env-item').forEach((item) => {
      const active = item.dataset.environment === runtime.environment;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });

    const controlButtons = document.querySelectorAll('[data-action]');
    controlButtons.forEach((button) => {
      const action = button.dataset.action;
      const enabled = action === 'boost' ? runtime.boost : action === 'orbit' ? runtime.orbit : action === 'auto' ? runtime.auto : false;
      button.classList.toggle('active', enabled);
      if (['boost', 'orbit', 'auto'].includes(action)) button.setAttribute('aria-pressed', String(enabled));
    });

    const preview = document.querySelector('.world-preview');
    if (preview) {
      const colors = environmentColors[runtime.environment] || environmentColors.Skyline;
      preview.style.setProperty('--scene-base', colors[0]);
      preview.style.setProperty('--scene-a', colors[1]);
      preview.style.setProperty('--scene-b', colors[2]);
    }
  }

  window.FrameLabs3UI = { renderDashboard };
})();
