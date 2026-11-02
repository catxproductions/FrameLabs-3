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

if (startButton && mainMenu && settingsScreen) {
  startButton.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
  });
}

const showMainMenu = () => {
  mainMenu.classList.remove('hidden');
  settingsScreen.classList.add('hidden');
};

if (closeSettings) {
  closeSettings.addEventListener('click', showMainMenu);
}

if (backToMenu) {
  backToMenu.addEventListener('click', showMainMenu);
}

if (launchSimulation && mainMenu && settingsScreen) {
  launchSimulation.addEventListener('click', () => {
    settingsScreen.classList.add('hidden');
    document.body.classList.add('game-started');

    const heroHeading = document.querySelector('.hero-copy h1');
    if (heroHeading) {
      heroHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

const optionGroups = document.querySelectorAll('.option');
optionGroups.forEach((option) => {
  option.addEventListener('click', () => {
    const group = option.parentElement;
    group.querySelectorAll('.option').forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');
    const radio = option.querySelector('input');
    if (radio) {
      radio.checked = true;
    }
  });
});
