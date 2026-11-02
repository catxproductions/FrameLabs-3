(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const counts = { Compact: 32, Medium: 64, Large: 100, Massive: 140 };

  function createSimulation(canvas) {
    const context = canvas.getContext('2d');
    const agents = [];
    let running = false;
    let frameId = null;
    let previous = 0;
    let metricWindow = 0;
    let frameCount = 0;
    let elapsed = 0;
    let focus = false;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seedAgents() {
      agents.length = 0;
      const state = window.FrameLabs3State.state;
      const count = counts[state.settings.size] || counts.Compact;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.08 + Math.random() * 0.38;
        agents.push({
          x: 0.5 + Math.cos(angle) * radius,
          y: 0.5 + Math.sin(angle) * radius * 0.65,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          phase: Math.random() * Math.PI * 2,
          size: 1.4 + Math.random() * 2.2
        });
      }
      state.runtime.agents = agents.length;
    }

    function draw(width, height) {
      const state = window.FrameLabs3State.state;
      const runtime = state.runtime;
      const base = runtime.environment === 'Tundra' ? '#172a3d' : runtime.environment === 'Abyss' ? '#091a2c' : '#141d3b';
      context.clearRect(0, 0, width, height);
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);

      const glow = context.createRadialGradient(width * 0.5, height * 0.5, 2, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
      glow.addColorStop(0, 'rgba(77, 134, 255, 0.22)');
      glow.addColorStop(1, 'rgba(3, 8, 20, 0.08)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = 'rgba(175, 206, 255, 0.08)';
      context.lineWidth = 1;
      for (let y = height * 0.58; y < height; y += 18) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }

      const centerX = focus ? width * 0.5 : width * (0.5 + Math.sin(elapsed * 0.17) * 0.025);
      const centerY = height * 0.48;
      context.strokeStyle = 'rgba(130, 176, 255, 0.18)';
      context.beginPath(); context.ellipse(centerX, centerY, Math.min(width, height) * 0.34, Math.min(width, height) * 0.2, 0, 0, Math.PI * 2); context.stroke();

      for (const agent of agents) {
        const x = agent.x * width;
        const y = agent.y * height;
        const glowColor = runtime.environment === 'Tundra' ? '170, 221, 255' : runtime.environment === 'Abyss' ? '105, 224, 209' : '124, 156, 255';
        context.fillStyle = `rgba(${glowColor}, ${0.48 + 0.42 * Math.sin(agent.phase)})`;
        context.beginPath(); context.arc(x, y, agent.size, 0, Math.PI * 2); context.fill();
      }

      if (runtime.scans > 0) {
        const scanPhase = (elapsed * 0.55) % 1;
        context.strokeStyle = `rgba(92, 231, 212, ${0.45 * (1 - scanPhase)})`;
        context.lineWidth = 2;
        context.beginPath(); context.arc(centerX, centerY, scanPhase * Math.max(width, height) * 0.6, 0, Math.PI * 2); context.stroke();
      }
    }

    function step(timestamp) {
      if (!running) return;
      const start = performance.now();
      const dt = previous ? clamp((timestamp - previous) / 1000, 0, 0.05) : 0;
      previous = timestamp;
      elapsed += dt;
      metricWindow += dt;
      frameCount += 1;

      const runtime = window.FrameLabs3State.state.runtime;
      const acceleration = runtime.boost ? 0.19 : 0.1;
      const center = 0.5;
      for (const agent of agents) {
        agent.phase += dt * (runtime.boost ? 2.4 : 1.2);
        if (runtime.orbit) {
          const dx = center - agent.x;
          const dy = center - agent.y;
          agent.vx += (-dy * acceleration - dx * 0.025) * dt;
          agent.vy += (dx * acceleration - dy * 0.025) * dt;
        }
        agent.vx += (Math.sin(agent.phase * 0.7) * 0.006) * dt;
        agent.vy += (Math.cos(agent.phase * 0.8) * 0.006) * dt;
        agent.x += agent.vx * dt;
        agent.y += agent.vy * dt;
        if (agent.x < 0.04 || agent.x > 0.96) agent.vx *= -1;
        if (agent.y < 0.08 || agent.y > 0.92) agent.vy *= -1;
        agent.x = clamp(agent.x, 0.04, 0.96);
        agent.y = clamp(agent.y, 0.08, 0.92);
      }

      const rect = canvas.getBoundingClientRect();
      draw(rect.width, rect.height);

      if (metricWindow >= 0.5) {
        const measuredFps = frameCount / metricWindow;
        const computeMs = performance.now() - start;
        const workLoad = clamp(12 + agents.length * 0.35 + (runtime.boost ? 8 : 0) + (runtime.orbit ? 6 : 0), 0, 100);
        const energy = clamp(runtime.energy - (runtime.boost ? 0.25 : 0.08) * metricWindow, 0, 100);
        window.FrameLabs3State.updateTelemetry({
          fps: measuredFps,
          latency: computeMs,
          load: workLoad,
          energy,
          integrity: Math.max(90, 100 - elapsed * 0.01),
          elapsed
        });
        window.FrameLabs3UI.renderDashboard();
        metricWindow = 0;
        frameCount = 0;
      }

      frameId = requestAnimationFrame(step);
    }

    return {
      start() {
        if (running) return;
        running = true;
        previous = 0;
        resize();
        seedAgents();
        frameId = requestAnimationFrame(step);
      },
      stop() {
        running = false;
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
      },
      resize,
      focus() { focus = !focus; }
    };
  }

  window.FrameLabs3Simulation = { createSimulation, instance: null };
})();
