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
  quality: 'Performance'
};

const syncSimulationState = () => {
  simState.mode = getSelectedOption('mode');
  simState.size = getSelectedOption('size');
  simState.realism = getSelectedOption('realism');
  simState.quality = getSelectedOption('quality');
  window.framelabsSimState = { ...simState };
};

const showMainMenu = () => {
  if (mainMenu) mainMenu.classList.remove('hidden');
  if (settingsScreen) settingsScreen.classList.add('hidden');
  if (launchSequence) launchSequence.classList.add('hidden');
  if (dashboardScreen) dashboardScreen.classList.add('hidden');
  if (appShell) appShell.classList.add('hidden');
};

if (startButton && mainMenu && settingsScreen) {
  startButton.addEventListener('click', () => {
    syncSimulationState();
    mainMenu.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
  });
}

if (closeSettings) closeSettings.addEventListener('click', showMainMenu);
if (backToMenu) backToMenu.addEventListener('click', showMainMenu);

if (launchSimulation && settingsScreen && launchSequence && dashboardScreen && appShell) {
  launchSimulation.addEventListener('click', () => {
    syncSimulationState();
    settingsScreen.classList.add('hidden');
    launchSequence.classList.remove('hidden');

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
        launchStatus.textContent = statuses[Math.min(Math.floor(progress / 20), statuses.length - 1)] + ` • ${simState.size}`;
      }

      if (progress >= 100) {
        setTimeout(() => {
          launchSequence.classList.add('hidden');
          dashboardScreen.classList.remove('hidden');
          appShell.classList.add('hidden');

          const statusNodes = document.querySelectorAll('.dot-row');
          if (statusNodes.length > 0) {
            statusNodes[0].innerHTML = `<span class="online-dot"></span> ${simState.mode} compute active`;
            statusNodes[1].innerHTML = `<span class="online-dot"></span> ${simState.realism} fidelity`;
          }
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

const launchDemoButtons = document.querySelectorAll('.launch-demo-button');
launchDemoButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (mainMenu) mainMenu.classList.remove('hidden');
    if (settingsScreen) settingsScreen.classList.add('hidden');
    if (launchSequence) launchSequence.classList.add('hidden');
    if (dashboardScreen) dashboardScreen.classList.add('hidden');
    if (appShell) appShell.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
