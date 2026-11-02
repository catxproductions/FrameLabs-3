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

const showMainMenu = () => {
  if (mainMenu) mainMenu.classList.remove('hidden');
  if (settingsScreen) settingsScreen.classList.add('hidden');
};

if (startButton && mainMenu && settingsScreen) {
  startButton.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
  });
}

if (closeSettings) {
  closeSettings.addEventListener('click', showMainMenu);
}

if (backToMenu) {
  backToMenu.addEventListener('click', showMainMenu);
}

if (launchSimulation && settingsScreen && launchSequence && dashboardScreen && appShell) {
  launchSimulation.addEventListener('click', () => {
    settingsScreen.classList.add('hidden');
    launchSequence.classList.remove('hidden');

    let progress = 0;
    const statuses = [
      'Preparing environment...',
      'Compiling simulation...',
      'Loading agents...',
      'Optimizing render...',
      'Launching system...'
    ];

    const tick = () => {
      progress += 20;
      if (launchProgress) launchProgress.style.width = `${progress}%`;
      if (launchStatus) launchStatus.textContent = statuses[Math.min(Math.floor(progress / 20), statuses.length - 1)];

      if (progress >= 100) {
        setTimeout(() => {
          launchSequence.classList.add('hidden');
          dashboardScreen.classList.remove('hidden');
          appShell.classList.add('hidden');
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
  });
});

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
