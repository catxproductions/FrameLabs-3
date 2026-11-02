## FrameLabs 3

FrameLabs 3 is an independent, browser-based interactive simulation prototype. It runs from the static site without installing packages or running terminal commands. The app uses a lightweight 2D agent-motion model in the browser; it does not connect to FrameLabs 2 or claim to use a real GPU/distributed backend.

### Open the app

Open `index.html` in a modern browser, or visit the repository's GitHub Pages site. No setup commands are required for users. The repository includes an optional Vite workflow for contributors (`npm install`, `npm run dev`, `npm run build`), but it is not required to use the static app.

### Runtime controls

Choose simulation settings, launch, then use the environment buttons and controls. The canvas shows moving agents; FPS is measured from the browser animation loop, compute time is measured locally, and load is estimated from active model complexity. These are local simulation telemetry, not hardware or network benchmarks.
