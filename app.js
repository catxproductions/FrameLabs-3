(function () {
  function selected(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : '';
  }

  function setScreen(name) {
    const ids = { main: 'mainMenu', settings: 'settingsScreen', launch: 'launchSequence', dashboard: 'dashboardScreen' };
    Object.entries(ids).forEach(([key, id]) => document.getElementById(id)?.classList.toggle('hidden', key !== name));
    document.getElementById('appShell')?.classList.toggle('hidden', name !== 'main');
  }

  function configure() {
    const state = window.FrameLabs3State.configure({ mode: selected('mode'), size: selected('size'), realism: selected('realism'), quality: selected('quality') });
    window.FrameLabs3UI.renderDashboard();
    return state;
  }

  function prepareStructuralWorkspace() {
    const dashboard = document.getElementById('dashboardScreen');
    if (!dashboard || dashboard.dataset.structuralReady) return;
    dashboard.dataset.structuralReady = 'true';
    const metricCards = dashboard.querySelectorAll('.panel-metric');
    [['Joints', '0'], ['Members', '0'], ['Stability', '100%'], ['Peak stress', '0%']].forEach(([label, value], index) => {
      if (!metricCards[index]) return;
      const span = metricCards[index].querySelector('span'); const strong = metricCards[index].querySelector('strong');
      if (span) span.textContent = label; if (strong) strong.textContent = value;
    });
    const environmentCard = dashboard.querySelector('.lower-grid .lower-card:first-child');
    if (environmentCard) environmentCard.innerHTML = '<div class="card-head"><p class="hud-label">Structure tools</p></div><p class="tool-help">Choose a tool, then click the canvas. Add joints, connect them with members, or apply a downward load to a free joint.</p><div class="control-grid tool-grid"><button type="button" data-tool="select">Select</button><button type="button" data-tool="node">Add joint</button><button type="button" data-tool="member">Add member</button><button type="button" data-tool="load">Load tool</button></div><div class="stress-legend"><span><i class="stress-low"></i>Low</span><span><i class="stress-mid"></i>Elevated</span><span><i class="stress-high"></i>High</span></div>';
    const controlsCard = dashboard.querySelector('.lower-grid .lower-card:last-child');
    if (controlsCard) controlsCard.innerHTML = '<div class="card-head"><p class="hud-label">Analysis controls</p></div><div class="control-grid"><button type="button" data-action="pause">Pause</button><button type="button" data-action="load">Add load</button><button type="button" data-action="scan">Recalculate stress</button><button type="button" data-action="reset">Reset frame</button></div><p class="solver-note">Simplified 2D axial-member model for interactive exploration — not for real structural design or safety decisions.</p>';
    const canvas = dashboard.querySelector('#simulationCanvas');
    if (canvas) {
      canvas.setAttribute('aria-label', 'Interactive structural frame: members are colored by calculated axial strain utilization');
      canvas.title = 'Choose a tool below, then interact with joints and members here';
    }
    const telemetryLabels = dashboard.querySelectorAll('.telemetry span');
    if (telemetryLabels.length >= 3) { telemetryLabels[0].textContent = 'Peak stress'; telemetryLabels[1].textContent = 'Supports'; telemetryLabels[2].textContent = 'Run time'; }
    const sessionHeading = dashboard.querySelector('.dashboard-sidebar h4');
    if (sessionHeading) sessionHeading.textContent = 'Starter frame';
    const sidebarItems = dashboard.querySelectorAll('.sidebar-list li');
    ['Structure', 'Members', 'Stress map', 'Results'].forEach((text, index) => { if (sidebarItems[index]) sidebarItems[index].textContent = text; });
  }

  function launch() {
    const state = configure();
    prepareStructuralWorkspace();
    const progress = document.getElementById('launchProgress');
    const status = document.getElementById('launchStatus');
    const button = document.getElementById('launchSimulation');
    if (button) button.disabled = true;
    if (progress) progress.style.width = '0%';
    setScreen('launch');
    let step = 0;
    const messages = ['Creating structural frame', 'Preparing supports and members', 'Starting 2D stress solver', 'Calculating member strain', 'Ready'];
    const tick = () => {
      step += 1;
      if (progress) progress.style.width = `${step * 20}%`;
      if (status) status.textContent = `${messages[step - 1]} · ${state.settings.size} · ${state.settings.quality}`;
      if (step < messages.length) return setTimeout(tick, 240);
      try {
        const canvas = document.getElementById('simulationCanvas');
        window.FrameLabs3Simulation.instance?.stop();
        const sim = window.FrameLabs3Simulation.createSimulation(canvas, { size: state.settings.size });
        window.FrameLabs3Simulation.instance = sim;
        setScreen('dashboard');
        sim.start();
      } catch (error) {
        if (status) status.textContent = `Unable to start: ${error.message}`;
        if (button) button.disabled = false;
        return;
      }
      if (button) button.disabled = false;
    };
    setTimeout(tick, 120);
  }

  function bind() {
    document.getElementById('startButton')?.addEventListener('click', () => { configure(); setScreen('settings'); });
    document.getElementById('closeSettings')?.addEventListener('click', () => setScreen('main'));
    document.getElementById('backToMenu')?.addEventListener('click', () => setScreen('main'));
    document.getElementById('launchSimulation')?.addEventListener('click', launch);
    document.getElementById('exitDashboard')?.addEventListener('click', () => { window.FrameLabs3Simulation.instance?.stop(); setScreen('main'); });
    document.querySelectorAll('.option input').forEach((input) => input.addEventListener('change', () => {
      document.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => radio.closest('.option')?.classList.toggle('selected', radio.checked));
      configure();
    }));
    document.querySelectorAll('.launch-demo-button').forEach((button) => button.addEventListener('click', () => { configure(); setScreen('settings'); }));
    document.querySelectorAll('.showcase-button').forEach((button) => button.addEventListener('click', () => document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth' })));
    document.addEventListener('click', (event) => {
      const toolButton = event.target.closest('[data-tool]');
      if (toolButton) { window.FrameLabs3Simulation.instance?.setTool(toolButton.dataset.tool); return; }
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const sim = window.FrameLabs3Simulation.instance;
      if (!sim) return;
      switch (actionButton.dataset.action) {
        case 'pause': sim.togglePause(); break;
        case 'load': sim.addLoad(); break;
        case 'reset': sim.reset(); break;
        case 'scan': sim.model.time += 0; window.FrameLabs3State.updateRuntime({ status: 'Stress map recalculated' }); window.FrameLabs3UI.renderDashboard(); break;
      }
    });
    window.addEventListener('resize', () => window.FrameLabs3Simulation.instance?.resize());
  }

  function init() {
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: 0.15 });
      revealElements.forEach((element) => observer.observe(element));
    } else revealElements.forEach((element) => element.classList.add('visible'));
    bind(); configure(); prepareStructuralWorkspace(); setScreen('main');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
