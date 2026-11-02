(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function getSelectedOption(groupName) {
    const option = document.querySelector(`input[name="${groupName}"]:checked`);
    if (!option) return 'standard';
    return option.value || option.closest('.option')?.querySelector('span')?.textContent || 'standard';
  }

  function syncSettingsFromDOM() {
    const next = {
      mode: getSelectedOption('mode'),
      size: getSelectedOption('size'),
      realism: getSelectedOption('realism'),
      quality: getSelectedOption('quality')
    };

    if (!window.FrameLabs3State || typeof window.FrameLabs3State.buildStateFromOptions !== 'function') {
      return next;
    }

    const state = window.FrameLabs3State.buildStateFromOptions(next);
    return state;
  }

  function setVisibleScreen(name) {
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

  function startLaunchSequence() {
    const settingsState = syncSettingsFromDOM();
    const state = settingsState || window.FrameLabs3State.state;
    const launchStatusNode = document.getElementById('launchStatus');
    const launchProgressNode = document.getElementById('launchProgress');

    setVisibleScreen('launch');

    const launchSummary = [
      `Mode: ${state.settings.mode}`,
      `Size: ${state.settings.size}`,
      `Realism: ${state.settings.realism}`,
      `Quality: ${state.settings.quality}`
    ].join(' • ');

    if (launchStatusNode) {
      launchStatusNode.textContent = `Loading ${state.settings.mode} profile • ${launchSummary}`;
    }

    let progress = 0;
    const statuses = [
      'Preparing environment...',
      'Compiling simulation...',
      `Loading ${state.settings.mode.toLowerCase()} agents...`,
      `Optimizing ${state.settings.quality.toLowerCase()} render...`,
      'Launching system...'
    ];

    const tick = () => {
      progress += 20;
      if (launchProgressNode) {
        launchProgressNode.style.width = `${progress}%`;
      }

      if (launchStatusNode) {
        const label = statuses[Math.min(Math.floor(progress / 20), statuses.length - 1)] || 'Launching system...';
        launchStatusNode.textContent = `${label} • ${state.settings.size}`;
      }

      if (progress >= 100) {
        setTimeout(() => {
          if (window.FrameLabs3UI && typeof window.FrameLabs3UI.renderDashboard === 'function') {
            window.FrameLabs3UI.renderDashboard();
          }
          setVisibleScreen('dashboard');
        }, 500);
        return;
      }

      setTimeout(tick, 420);
    };

    setTimeout(tick, 300);
  }

  function bindEventHandlers() {
    const startButton = document.getElementById('startButton');
    const closeSettings = document.getElementById('closeSettings');
    const backToMenu = document.getElementById('backToMenu');
    const launchSimulation = document.getElementById('launchSimulation');

    if (startButton) {
      startButton.addEventListener('click', () => {
        syncSettingsFromDOM();
        setVisibleScreen('settings');
      });
    }

    if (closeSettings) {
      closeSettings.addEventListener('click', () => setVisibleScreen('main'));
    }

    if (backToMenu) {
      backToMenu.addEventListener('click', () => setVisibleScreen('main'));
    }

    if (launchSimulation) {
      launchSimulation.addEventListener('click', startLaunchSequence);
    }

    document.querySelectorAll('.option').forEach((option) => {
      option.addEventListener('click', () => {
        const group = option.parentElement;
        if (!group) return;

        group.querySelectorAll('.option').forEach((item) => item.classList.remove('selected'));
        option.classList.add('selected');

        const radio = option.querySelector('input');
        if (radio) radio.checked = true;

        syncSettingsFromDOM();

        if (window.FrameLabs3UI && typeof window.FrameLabs3UI.renderDashboard === 'function') {
          window.FrameLabs3UI.renderDashboard();
        }
      });
    });

    document.querySelectorAll('.launch-demo-button').forEach((button) => {
      button.addEventListener('click', () => {
        syncSettingsFromDOM();
        setVisibleScreen('settings');
      });
    });

    document.querySelectorAll('.showcase-button').forEach((button) => {
      button.addEventListener('click', () => {
        const section = document.getElementById('experience');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function bootstrap() {
    if (!window.FrameLabs3State) {
      return;
    }

    syncSettingsFromDOM();
    bindEventHandlers();

    if (window.FrameLabs3UI && typeof window.FrameLabs3UI.renderDashboard === 'function') {
      window.FrameLabs3UI.renderDashboard();
    }

    setVisibleScreen('main');

    if (window.FrameLabs3Simulation && window.FrameLabs3Simulation.createSimulation) {
      const sim = window.FrameLabs3Simulation.createSimulation();
      window.FrameLabs3Simulation.instance = sim;
      sim.start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
