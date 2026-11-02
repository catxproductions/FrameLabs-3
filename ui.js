(function () {
  function renderDashboard() {
    const { runtime, settings } = window.FrameLabs3State.state;
    const simulation = window.FrameLabs3Simulation && window.FrameLabs3Simulation.instance;
    const model = simulation && simulation.model;
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = String(value);
    };

    set('#dashboardScreen .hud-metrics div:nth-child(1) strong', `${Number(runtime.latency || 0).toFixed(2)}ms`);
    set('#dashboardScreen .hud-metrics div:nth-child(2) strong', runtime.fps || 0);
    set('#dashboardScreen .hud-metrics div:nth-child(3) strong', model ? `${model.nodes.length} joints` : 'Ready');

    const stats = document.querySelectorAll('#dashboardScreen .panel-metric strong');
    if (stats.length >= 4) {
      stats[0].textContent = model ? String(model.nodes.length) : '0';
      stats[1].textContent = model ? String(model.members.length) : '0';
      stats[2].textContent = model ? `${Number(runtime.stability ?? 100).toFixed(0)}%` : '100%';
      stats[3].textContent = model ? `${(Number(runtime.maxStress || 0) * 100).toFixed(0)}%` : '0%';
    }

    const description = document.querySelector('#dashboardScreen .hero-panel-copy p:last-child');
    if (description) description.textContent = model
      ? `${model.nodes.length} joints · ${model.members.length} members · ${Number(runtime.elapsed || 0).toFixed(1)}s simulated. Simplified 2D axial-member model; not engineering analysis.`
      : 'A browser-based structural frame workspace.';

    const telemetry = document.querySelectorAll('#dashboardScreen .telemetry strong');
    if (telemetry.length >= 3) {
      telemetry[0].textContent = `${(Number(runtime.maxStress || 0) * 100).toFixed(0)}%`;
      telemetry[1].textContent = model ? String(model.nodes.filter((node) => node.fixed).length) : '0';
      telemetry[2].textContent = model ? `${Number(runtime.elapsed || 0).toFixed(1)}s` : '0s';
    }

    const rows = document.querySelectorAll('#dashboardScreen .status-list .dot-row');
    if (rows.length >= 3) {
      rows[0].textContent = `${settings.mode} local solver`;
      rows[1].textContent = model ? `${model.members.length} axial members · simplified model` : 'Structural model ready';
      rows[2].textContent = runtime.status || 'Ready';
    }

    const tool = model ? model.tool : 'select';
    document.querySelectorAll('[data-tool]').forEach((button) => {
      const selected = button.dataset.tool === tool;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const runButton = document.querySelector('[data-action="pause"]');
    if (runButton && model) runButton.textContent = model.paused ? 'Resume' : 'Pause';
  }
  window.FrameLabs3UI = { renderDashboard };
})();
