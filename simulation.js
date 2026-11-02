(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function createSimulation() {
    return {
      running: false,
      rafId: null,
      lastTimestamp: 0,
      step: 0,
      pulse: 0,

      start() {
        if (this.running) return;
        this.running = true;
        this.lastTimestamp = 0;
        const tick = (timestamp) => {
          if (!this.running) return;
          if (!this.lastTimestamp) this.lastTimestamp = timestamp;
          const delta = (timestamp - this.lastTimestamp) / 1000;
          this.lastTimestamp = timestamp;
          this.update(delta);
          this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
      },

      stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
      },

      update(delta) {
        const state = window.FrameLabs3State.state;
        const runtime = state.runtime;
        this.step += delta;
        this.pulse += delta * 0.9;

        const drift = Math.sin(this.step * 1.6) * 4;
        const qualityBias = {
          Performance: 0,
          'High Quality': 4,
          Ultra: 7,
          Prototype: 3
        }[state.settings.quality] || 0;

        const modeBias = {
          Standard: 1,
          'GPU Accelerated': 3,
          'Ultra Render': 5,
          Distributed: 7
        }[state.settings.mode] || 1;

        const realismBias = {
          Balanced: 0,
          High: 3,
          Cinematic: 6,
          Experimental: 10
        }[state.settings.realism] || 0;

        runtime.energy = clamp(Math.round((runtime.energy || 84) + Math.sin(this.pulse * 2.2) * 2 + qualityBias - 0.5), 50, 99);
        runtime.integrity = clamp(Math.round((runtime.integrity || 96) + Math.cos(this.pulse * 1.3) * 1.5 + modeBias * 0.3), 70, 99);
        runtime.load = clamp(Math.round((runtime.load || 72) + Math.sin(this.pulse * 0.9) * 5 + (state.settings.size === 'Massive' ? 2 : 0)), 35, 95);
        runtime.fps = clamp(Math.round(runtime.fps + drift * 0.5), 48, 220);
        runtime.latency = clamp(Math.round(runtime.latency + Math.cos(this.pulse * 1.1) * 0.7 + (state.settings.quality === 'Ultra' ? 0.5 : 0)), 4, 30);

        if (window.FrameLabs3UI && typeof window.FrameLabs3UI.renderDashboard === 'function') {
          window.FrameLabs3UI.renderDashboard();
        }
      }
    };
  }

  window.FrameLabs3Simulation = {
    createSimulation
  };
})();
