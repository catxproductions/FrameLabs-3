(function () {
  const defaults = {
    settings: { mode: 'Standard', size: 'Compact', realism: 'Balanced', quality: 'Performance' },
    runtime: {
      fps: 0, latency: 0, load: 0, energy: 100, integrity: 100,
      signal: 'Stable', threat: 'Low', environment: 'Skyline',
      status: 'Ready to simulate', agents: 0, scans: 0, elapsed: 0,
      boost: false, orbit: true, auto: true
    }
  };

  const state = {
    settings: { ...defaults.settings },
    runtime: { ...defaults.runtime }
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function configure(settings) {
    state.settings = {
      mode: settings.mode || defaults.settings.mode,
      size: settings.size || defaults.settings.size,
      realism: settings.realism || defaults.settings.realism,
      quality: settings.quality || defaults.settings.quality
    };

    const countBySize = { Compact: 32, Medium: 64, Large: 100, Massive: 140 };
    const count = countBySize[state.settings.size] || countBySize.Compact;
    const qualityScale = { Performance: 0.7, 'High Quality': 1, Ultra: 1.25, Prototype: 0.85 }[state.settings.quality] || 1;
    const realismScale = { Balanced: 0.8, High: 1, Cinematic: 1.15, Experimental: 1.35 }[state.settings.realism] || 1;

    state.runtime.agents = Math.round(count * qualityScale);
    state.runtime.load = clamp(Math.round(18 + state.runtime.agents * 0.42 * realismScale), 10, 95);
    state.runtime.energy = 100;
    state.runtime.integrity = 100;
    state.runtime.signal = state.settings.mode === 'Distributed' ? 'High' : 'Stable';
    state.runtime.threat = state.settings.realism === 'Experimental' ? 'Elevated' : 'Low';
    state.runtime.status = 'Simulation initialized';
    state.runtime.elapsed = 0;
    state.runtime.scans = 0;
    return state;
  }

  function setEnvironment(environment) {
    if (!['Skyline', 'Tundra', 'Abyss'].includes(environment)) return;
    state.runtime.environment = environment;
    state.runtime.status = `${environment} environment loaded`;
  }

  function toggle(key) {
    if (['boost', 'orbit', 'auto'].includes(key)) state.runtime[key] = !state.runtime[key];
    return state.runtime[key];
  }

  function scan() {
    state.runtime.scans += 1;
    state.runtime.status = `Scan ${state.runtime.scans} complete — ${state.runtime.agents} agents tracked`;
  }

  function updateTelemetry({ fps, latency, load, energy, integrity, elapsed }) {
    Object.assign(state.runtime, {
      fps: clamp(Math.round(fps), 0, 240),
      latency: clamp(Number(latency.toFixed(2)), 0, 1000),
      load: clamp(Math.round(load), 0, 100),
      energy: clamp(Math.round(energy), 0, 100),
      integrity: clamp(Number(integrity.toFixed(1)), 0, 100),
      elapsed: Math.max(0, elapsed)
    });
  }

  function reset() {
    state.settings = { ...defaults.settings };
    state.runtime = { ...defaults.runtime };
  }

  window.FrameLabs3State = { state, defaults, configure, setEnvironment, toggle, scan, updateTelemetry, reset };
})();
