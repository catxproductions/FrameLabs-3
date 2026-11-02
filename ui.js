(function () {
  function renderDashboard() {
    const { runtime, settings } = window.FrameLabs3State.state;
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = String(value);
    };

    set('#dashboardScreen .hud-metrics div:nth-child(1) strong', `${runtime.latency.toFixed(runtime.latency < 10 ? 1 : 0)}ms`);
    set('#dashboardScreen .hud-metrics div:nth-child(2) strong', runtime.fps);
    set('#dashboardScreen .hud-metrics div:nth-child(3) strong', `${runtime.load}%`);
    set('#dashboardScreen .hero-panel-copy h2', 'Structural Sandbox');

    const description = document.querySelector('#dashboardScreen .hero-panel-copy p');
    if (description) description.textContent = `${runtime.agents} browser-simulated agents interacting around the structural build area. Simulation time: ${runtime.elapsed.toFixed(1)}s.`;

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
      rows[1].textContent = 'Structural Sandbox active';
      rows[2].textContent = runtime.status;
    }

    document.querySelectorAll('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      const enabled = action === 'boost' ? runtime.boost : action === 'orbit' ? runtime.orbit : action === 'auto' ? runtime.auto : false;
      button.classList.toggle('active', enabled);
      if (['boost', 'orbit', 'auto'].includes(action)) button.setAttribute('aria-pressed', String(enabled));
    });
  }

  window.FrameLabs3UI = { renderDashboard };
})();
