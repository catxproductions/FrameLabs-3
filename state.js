(function () {
  const defaults = {
    settings: { mode: 'Standard', size: 'Compact', realism: 'Balanced', quality: 'Performance' },
    runtime: { fps: 0, latency: 0, load: 0, elapsed: 0, status: 'Ready to simulate', scans: 0 }
  };
  const state = { settings: { ...defaults.settings }, runtime: { ...defaults.runtime } };

  function configure(settings) {
    state.settings = {
      mode: settings.mode || defaults.settings.mode,
      size: settings.size || defaults.settings.size,
      realism: settings.realism || defaults.settings.realism,
      quality: settings.quality || defaults.settings.quality
    };
    state.runtime = { ...defaults.runtime, status: 'Structural model initialized' };
    return state;
  }

  function updateRuntime(values) {
    Object.assign(state.runtime, values);
  }

  function reset() {
    state.settings = { ...defaults.settings };
    state.runtime = { ...defaults.runtime };
  }

  window.FrameLabs3State = { state, defaults, configure, updateRuntime, reset };
})();
