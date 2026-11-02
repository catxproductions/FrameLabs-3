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

if (startButton && mainMenu) {
  startButton.addEventListener('click', () => {
    document.body.classList.add('game-started');
    mainMenu.classList.add('hidden');

    const heroHeading = document.querySelector('.hero-copy h1');
    if (heroHeading) {
      heroHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
