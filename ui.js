(function () {
  function getContainerText(selector) {
    const node = document.querySelector(selector);
    return node ? node.textContent.trim() : '';
  }

  function renderDashboard() {
    const runtime = window.FrameLabs3State.state.runtime;
    const settings = window.FrameLabs3State.state.settings;

    const metricEls = {
      latency: document.querySelector('#dashboardScreen .hud-metrics div:nth-child(1) strong'),
      fps: document.querySelector('#dashboardScreen .hud-metrics div:nth-child(2) strong'),
      load: document.querySelector('#dashboardScreen .hud-metrics div:nth-child(3) strong')
    };

    if (metricEls.latency) metricEls.latency.textContent = `${runtime.latency}ms`;
    if (metricEls.fps) metricEls.fps.textContent = String(runtime.fps);
    if (metricEls.load) metricEls.load.textContent = `${runtime.load}%`;

    const envHeader = document.querySelector('#dashboardScreen .hero-panel-copy h2');
    const envText = document.querySelector('#dashboardScreen .hero-panel-copy p');
    if (envHeader) envHeader.textContent = `${runtime.environment} Nexus`;
    if (envText) {
      envText.textContent = `High-density ${settings.realism.toLowerCase()} simulation layer with adaptive ${settings.mode.toLowerCase()} compute and live scene reconstruction.`;
    }

    const stats = document.querySelectorAll('#dashboardScreen .panel-metric strong');
    if (stats.length >= 4) {
      stats[0].textContent = `${runtime.energy}%`;
      stats[1].textContent = `${runtime.integrity.toFixed(1)}%`;
      stats[2].textContent = runtime.signal;
      stats[3].textContent = runtime.threat;
    }

    const telemetry = document.querySelectorAll('#dashboardScreen .telemetry strong');
    if (telemetry.length >= 3) {
      telemetry[0].textContent = `${Math.max(60, Math.min(98, runtime.energy - 5))}°`;
      telemetry[1].textContent = `${Math.max(50, Math.min(99, runtime.load + 8))}%`;
      telemetry[2].textContent = `${(runtime.fps / 120).toFixed(1)}x`;
    }

    const systemStatus = document.querySelectorAll('#dashboardScreen .status-list .dot-row');
    if (systemStatus.length >= 3) {
      systemStatus[0].innerHTML = `<span class="online-dot"></span> ${settings.mode} compute active`;
      systemStatus[1].innerHTML = `<span class="online-dot"></span> ${settings.realism} fidelity`;
      systemStatus[2].innerHTML = `<span class="online-dot"></span> ${runtime.status}`;
    }

    const envTabs = document.querySelectorAll('.env-item');
    envTabs.forEach((tab) => {
      const active = tab.textContent.trim() === runtime.environment;
      tab.classList.toggle('active', active);
    });
  }

  function setScreenVisibility(name) {
    const screens = {
      main: document.getElementById('mainMenu'),
      settings: document.getElementById('settingsScreen'),
      launch: document.getElementById('launchSequence'),
      dashboard: document.getElementById('dashboardScreen')
    };

    Object.keys(screens).forEach((key) => {
      const node = screens[key];
      if (!node) return;
      node.classList.toggle('hidden', key !== name);
    });

    const appShell = document.getElementById('appShell');
    if (appShell) {
      appShell.classList.toggle('hidden', name !== 'main');
    }
  }

  window.FrameLabs3UI = {
    renderDashboard,
    setScreenVisibility
  };
})();
