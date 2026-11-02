(function () {
  const defaults = {
    settings: {
      mode: 'Standard',
      size: 'Compact',
      realism: 'Balanced',
      quality: 'Performance'
    },
    runtime: {
      fps: 144,
      latency: 12,
      load: 72,
      energy: 84,
      integrity: 96,
      signal: 'Stable',
      threat: 'Low',
      environment: 'Skyline',
      deck: 'Lab Delta',
      status: 'System nominal'
    }
  };

  const state = {
    settings: { ...defaults.settings },
    runtime: { ...defaults.runtime }
  };

  const modeMap = {
    Standard: { latency: 12, fps: 140, load: 68 },
    'GPU Accelerated': { latency: 9, fps: 160, load: 74 },
    'Ultra Render': { latency: 7, fps: 180, load: 83 },
    Distributed: { latency: 6, fps: 200, load: 88 }
  };

  const qualityMap = {
    Performance: { fps: 120, latency: 14, load: 65, energy: 82 },
    'High Quality': { fps: 90, latency: 18, load: 73, energy: 88 },
    Ultra: { fps: 75, latency: 22, load: 81, energy: 92 },
    Prototype: { fps: 110, latency: 16, load: 70, energy: 86 }
  };

  const environmentOptions = ['Skyline', 'Tundra', 'Abyss'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildStateFromOptions(nextSettings) {
    const selectedMode = nextSettings.mode || state.settings.mode;
    const selectedSize = nextSettings.size || state.settings.size;
    const selectedRealism = nextSettings.realism || state.settings.realism;
    const selectedQuality = nextSettings.quality || state.settings.quality;

    const modePreset = modeMap[selectedMode] || modeMap.Standard;
    const qualityPreset = qualityMap[selectedQuality] || qualityMap.Performance;

    const sizeFactor = {
      Compact: 0.94,
      Medium: 1,
      Large: 1.08,
      Massive: 1.18
    }[selectedSize] || 1;

    const realismFactor = {
      Balanced: 1,
      High: 1.08,
      Cinematic: 1.16,
      Experimental: 1.24
    }[selectedRealism] || 1;

    const runtime = {
      fps: clamp(Math.round((qualityPreset.fps * modePreset.fps) / 160 * sizeFactor * realismFactor), 48, 220),
      latency: clamp(Math.round((modePreset.latency + qualityPreset.latency) / 2 * (1.12 - realismFactor * 0.08)), 4, 30),
      load: clamp(Math.round(qualityPreset.load + (selectedSize === 'Massive' ? 8 : selectedSize === 'Large' ? 4 : 0) + (selectedRealism === 'Experimental' ? 6 : 0)), 35, 95),
      energy: clamp(Math.round(qualityPreset.energy + (selectedMode === 'Distributed' ? 7 : selectedMode === 'Ultra Render' ? 5 : 0) - (selectedRealism === 'Experimental' ? 6 : 0)), 50, 99),
      integrity: clamp(Math.round(94 + (selectedQuality === 'Ultra' ? 3 : selectedQuality === 'Prototype' ? 1 : 0) - (selectedMode === 'Distributed' ? 1 : 0)), 70, 99),
      signal: selectedMode === 'Distributed' ? 'High' : selectedMode === 'GPU Accelerated' ? 'Optimal' : 'Stable',
      threat: selectedRealism === 'Experimental' ? 'Elevated' : selectedMode === 'Distributed' ? 'Moderate' : 'Low',
      environment: environmentOptions[Math.abs((selectedMode.length + selectedSize.length + selectedRealism.length + selectedQuality.length) % environmentOptions.length)],
      deck: 'Lab Delta',
      status: `${selectedMode} profile online`
    };

    state.settings = {
      mode: selectedMode,
      size: selectedSize,
      realism: selectedRealism,
      quality: selectedQuality
    };

    state.runtime = runtime;
    return { ...state };
  }

  function reset() {
    state.settings = { ...defaults.settings };
    state.runtime = { ...defaults.runtime };
  }

  window.FrameLabs3State = {
    state,
    defaults,
    buildStateFromOptions,
    reset
  };
})();
