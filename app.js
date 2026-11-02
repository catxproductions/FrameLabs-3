(function () {
  function selected(name) {
    const input = document.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : '';
  }

  function setScreen(name) {
    const ids = { main: 'mainMenu', settings: 'settingsScreen', launch: 'launchSequence', dashboard: 'dashboardScreen' };
    Object.entries(ids).forEach(([key, id]) => {
      const node = document.getElementById(id);
      if (node) node.classList.toggle('hidden', key !== name);
    });
    const shell = document.getElementById('appShell');
    if (shell) shell.classList.toggle('hidden', name !== 'main');
  }

  function configure() {
    const state = window.FrameLabs3State.configure({ mode: selected('mode'), size: selected('size'), realism: selected('realism'), quality: selected('quality') });
    window.FrameLabs3UI.renderDashboard();
    return state;
  }

  function launch() {
    const state = configure();
    const progress = document.getElementById('launchProgress');
    const status = document.getElementById('launchStatus');
    const button = document.getElementById('launchSimulation');
    if (button) button.disabled = true;
    if (progress) progress.style.width = '0%';
    setScreen('launch');
    let step = 0;
    const messages = ['Creating structural scene', 'Seeding simulation agents', 'Starting browser runtime', 'Measuring live performance', 'Ready'];
    const tick = () => {
      step += 1;
      if (progress) progress.style.width = `${step * 20}%`;
      if (status) status.textContent = `${messages[step - 1]} · ${state.settings.size} · ${state.settings.quality}`;
      if (step < messages.length) return setTimeout(tick, 260);
      try {
        const canvas = document.getElementById('simulationCanvas');
        const sim = window.FrameLabs3Simulation.createSimulation(canvas);
        window.FrameLabs3Simulation.instance?.stop();
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
    setTimeout(tick, 150);
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
    document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'scan') window.FrameLabs3State.scan();
      else if (action === 'focus') window.FrameLabs3Simulation.instance?.focus();
      else window.FrameLabs3State.toggle(action);
      window.FrameLabs3UI.renderDashboard();
    }));
    document.getElementById('toggleAuto')?.addEventListener('click', () => { window.FrameLabs3State.toggle('auto'); window.FrameLabs3UI.renderDashboard(); });
    window.addEventListener('resize', () => window.FrameLabs3Simulation.instance?.resize());
  }

  function init() {
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: 0.15 });
      revealElements.forEach((element) => observer.observe(element));
    } else revealElements.forEach((element) => element.classList.add('visible'));
    bind();
    configure();
    setScreen('main');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
