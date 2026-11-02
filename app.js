const reveals = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.18 }
);

reveals.forEach((element) => revealObserver.observe(element));

const startButton = document.getElementById('startButton');
const mainMenu = document.getElementById('mainMenu');
const settingsScreen = document.getElementById('settingsScreen');
const closeSettings = document.getElementById('closeSettings');
const backToMenu = document.getElementById('backToMenu');
const launchSimulation = document.getElementById('launchSimulation');
const launchSequence = document.getElementById('launchSequence');
const dashboardScreen = document.getElementById('dashboardScreen');
const appShell = document.getElementById('appShell');
const launchProgress = document.getElementById('launchProgress');
const launchStatus = document.getElementById('launchStatus');

const getSelectedOption = (groupName) => {
  const option = document.querySelector(`input[name="${groupName}"]:checked`);
  if (!option) return 'standard';
  const label = option.closest('.option');
  return label ? label.querySelector('span')?.textContent || option.value : option.value;
};

const simState = {
  mode: 'Standard',
  size: 'Compact',
  realism: 'Balanced',
  quality: 'Performance',
  fps: 144,
  latency: 12,
  load: 72,
  environment: 'Skyline'
};

const updateDashboardMetrics = () => {
  const latencyNode = document.querySelector('#dashboardScreen .hud-metrics div:nth-child(1) strong');
  const fpsNode = document.querySelector('#dashboardScreen .hud-metrics div:nth-child(2) strong');
  const loadNode = document.querySelector('#dashboardScreen .hud-metrics div:nth-child(3) strong');

  if (latencyNode) latencyNode.textContent = `${simState.latency}ms`;
  if (fpsNode) fpsNode.textContent = simState.fps;
  if (loadNode) loadNode.textContent = `${simState.load}%`;

  const envNameNode = document.querySelector('#dashboardScreen .hero-panel-copy h2');
  const envMetaNode = document.querySelector('#dashboardScreen .hero-panel-copy p');
  if (envNameNode) envNameNode.textContent = `${simState.environment} Nexus`;
  if (envMetaNode) {
    envMetaNode.textContent = `High-density ${simState.realism.toLowerCase()} simulation layer with adaptive ${simState.mode.toLowerCase()} compute and live scene reconstruction.`;
  }

  const statusNodes = document.querySelectorAll('#dashboardScreen .dot-row');
  if (statusNodes.length > 0) {
    const modeText = `${simState.mode} compute active`;
    const realismText = `${simState.realism} fidelity`;
    statusNodes[0].innerHTML = `<span class="online-dot"></span> ${modeText}`;
    statusNodes[1].innerHTML = `<span class="online-dot"></span> ${realismText}`;
  }

  const telemetry = document.querySelectorAll('#dashboardScreen .telemetry strong');
  if (telemetry.length >= 3) {
    telemetry[0].textContent = `${Math.max(60, Math.min(98, simState.load - 5))}°`;
    telemetry[1].textContent = `${Math.max(55, Math.min(99, simState.load + 8))}%`;
    telemetry[2].textContent = `${(simState.fps / 120).toFixed(1)}x`;
  }
};

const syncSimulationState = () => {
  simState.mode = getSelectedOption('mode');
  simState.size = getSelectedOption('size');
  simState.realism = getSelectedOption('realism');
  simState.quality = getSelectedOption('quality');

  const qualityMap = {
    Performance: { fps: 120, latency: 14, load: 65 },
    'High Quality': { fps: 90, latency: 18, load: 73 },
    Ultra: { fps: 75, latency: 22, load: 81 },
    Prototype: { fps: 110, latency: 16, load: 70 }
  };

  const modeMap = {
    Standard: { latency: 12 },
    'GPU Accelerated': { latency: 9 },
    'Ultra Render': { latency: 7 },
    Distributed: { latency: 6 }
  };

  const qualityPreset = qualityMap[simState.quality] || qualityMap.Performance;
  const modePreset = modeMap[simState.mode] || modeMap.Standard;

  simState.fps = qualityPreset.fps;
  simState.latency = modePreset.latency + qualityPreset.latency;
  simState.load = qualityPreset.load;
  simState.environment = ['Skyline', 'Tundra', 'Abyss'][Math.floor(Math.random() * 3)];

  window.framelabsSimState = { ...simState };
  updateDashboardMetrics();
};

const showScreen = (screenName) => {
  const screens = {
    main: mainMenu,
    settings: settingsScreen,
    launch: launchSequence,
    dashboard: dashboardScreen,
  };

  const screenOrder = [mainMenu, settingsScreen, launchSequence, dashboardScreen];
  screenOrder.forEach((screen) => {
    if (!screen) return;
    screen.classList.add('hidden');
  });

  if (screenName === 'main') {
    if (mainMenu) mainMenu.classList.remove('hidden');
  }
  if (screenName === 'settings') {
    if (settingsScreen) settingsScreen.classList.remove('hidden');
  }
  if (screenName === 'launch') {
    if (launchSequence) launchSequence.classList.remove('hidden');
  }
  if (screenName === 'dashboard') {
    if (dashboardScreen) dashboardScreen.classList.remove('hidden');
  }

  if (appShell) {
    const shouldHideShell = screenName !== 'main';
    appShell.classList.toggle('hidden', shouldHideShell);
  }
};

const showMainMenu = () => {
  showScreen('main');
};

if (startButton && mainMenu && settingsScreen) {
  startButton.addEventListener('click', () => {
    syncSimulationState();
    showScreen('settings');
  });
}

if (closeSettings) closeSettings.addEventListener('click', showMainMenu);
if (backToMenu) backToMenu.addEventListener('click', showMainMenu);

if (launchSimulation && settingsScreen && launchSequence && dashboardScreen && appShell) {
  launchSimulation.addEventListener('click', () => {
    syncSimulationState();
    showScreen('launch');

    const launchSummary = [
      `Mode: ${simState.mode}`,
      `Size: ${simState.size}`,
      `Realism: ${simState.realism}`,
      `Quality: ${simState.quality}`
    ].join(' • ');

    if (launchStatus) {
      launchStatus.textContent = `Loading ${simState.mode} profile • ${launchSummary}`;
    }

    let progress = 0;
    const statuses = [
      'Preparing environment...',
      'Compiling simulation...',
      `Loading ${simState.mode.toLowerCase()} agents...`,
      `Optimizing ${simState.quality.toLowerCase()} render...`,
      'Launching system...'
    ];

    const tick = () => {
      progress += 20;
      if (launchProgress) launchProgress.style.width = `${progress}%`;
      if (launchStatus) {
        const label = statuses[Math.min(Math.floor(progress / 20), statuses.length - 1)] || 'Launching system...';
        launchStatus.textContent = `${label} • ${simState.size}`;
      }

      if (progress >= 100) {
        setTimeout(() => {
          showScreen('dashboard');
          updateDashboardMetrics();
        }, 500);
        return;
      }

      setTimeout(tick, 420);
    };

    setTimeout(tick, 300);
  });
}

const optionGroups = document.querySelectorAll('.option');
optionGroups.forEach((option) => {
  option.addEventListener('click', () => {
    const group = option.parentElement;
    if (!group) return;

    group.querySelectorAll('.option').forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');

    const radio = option.querySelector('input');
    if (radio) radio.checked = true;

    syncSimulationState();
  });
});

const bindLaunchActions = () => {
  const launchButtons = document.querySelectorAll('.launch-demo-button');
  launchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      syncSimulationState();
      showScreen('settings');
    });
  });

  const showcaseButtons = document.querySelectorAll('.showcase-button');
  showcaseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const section = document.getElementById('experience');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
};

bindLaunchActions();

const appReadyState = document.getElementById('appReadyState');
if (appReadyState) {
  appReadyState.textContent = 'FrameLabs 3 ready';
}

showMainMenu();
updateDashboardMetrics();
