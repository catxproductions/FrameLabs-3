(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const sizeCounts = { Compact: 4, Medium: 6, Large: 8, Massive: 10 };
  const allowableStrain = 0.012;

  function makeNode(x, y, fixed) {
    return { x, y, vx: 0, vy: 0, fx: 0, fy: 0, fixed: Boolean(fixed), load: 0 };
  }

  function createModel(size) {
    const count = sizeCounts[size] || sizeCounts.Compact;
    const nodes = [];
    const members = [];
    const addNode = (x, y, fixed = false) => {
      nodes.push(makeNode(x, y, fixed));
      return nodes.length - 1;
    };
    const addMember = (a, b) => {
      const p = nodes[a]; const q = nodes[b];
      const dx = q.x - p.x; const dy = q.y - p.y;
      members.push({ a, b, rest: Math.hypot(dx, dy), stiffness: 34, axialForce: 0, utilization: 0, broken: false });
    };

    // A small, triangulated steel-frame starter structure with two pinned foundations.
    const divisions = Math.max(2, Math.floor((count - 2) / 2));
    const left = addNode(0.13, 0.84, true);
    const right = addNode(0.87, 0.84, true);
    const bottom = [left];
    for (let i = 1; i < divisions; i += 1) bottom.push(addNode(0.13 + 0.74 * i / divisions, 0.84));
    bottom.push(right);
    const top = [];
    for (let i = 0; i <= divisions; i += 1) {
      const x = 0.13 + 0.74 * i / divisions;
      const y = 0.38 - (i % 2 === 0 ? 0.08 : 0);
      top.push(addNode(x, y));
    }
    for (let i = 0; i < divisions; i += 1) {
      addMember(bottom[i], bottom[i + 1]);
      addMember(top[i], top[i + 1]);
      addMember(bottom[i], top[i]);
      addMember(top[i], bottom[i + 1]);
    }
    addMember(bottom[0], top[0]);
    addMember(top[divisions], bottom[divisions]);
    return { nodes, members, nextNodeId: nodes.length, time: 0, paused: false, tool: 'select', selectedNode: null, maxUtilization: 0 };
  }

  function createSimulation(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new Error('The structural canvas is missing.');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser does not support canvas rendering.');
    const model = createModel(options.size || 'Compact');
    let running = false;
    let frameId = null;
    let lastTimestamp = 0;
    let metricElapsed = 0;
    let metricFrames = 0;
    let focused = false;
    const baseWidth = 1000;
    const baseHeight = 600;
    const physicsWidth = 0.74;
    const physicsHeight = 0.46;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function pointToCanvas(point, width, height) {
      return { x: width * (0.13 + point.x * physicsWidth), y: height * (0.19 + point.y * physicsHeight) };
    }

    function canvasToPoint(x, y, width, height) {
      return {
        x: clamp((x / width - 0.13) / physicsWidth, 0.02, 0.98),
        y: clamp((y / height - 0.19) / physicsHeight, 0.02, 0.98)
      };
    }

    function stressColor(utilization) {
      if (utilization < 0.35) return '#57d7ad';
      if (utilization < 0.7) return '#e7ca68';
      if (utilization < 1) return '#ff985f';
      return '#ff5d70';
    }

    function calculateStress() {
      model.maxUtilization = 0;
      for (const member of model.members) {
        if (member.broken) continue;
        const a = model.nodes[member.a]; const b = model.nodes[member.b];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const length = Math.max(0.0001, Math.hypot(dx, dy));
        const strain = (length - member.rest) / member.rest;
        member.axialForce = member.stiffness * (length - member.rest);
        member.utilization = Math.abs(strain) / allowableStrain;
        model.maxUtilization = Math.max(model.maxUtilization, member.utilization);
      }
    }

    function draw(width, height) {
      context.clearRect(0, 0, width, height);
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#101a32'); background.addColorStop(1, '#080d18');
      context.fillStyle = background; context.fillRect(0, 0, width, height);

      const gridStep = Math.max(24, Math.round(width / 28));
      context.lineWidth = 1; context.strokeStyle = 'rgba(147, 177, 229, 0.10)';
      for (let x = 0; x < width; x += gridStep) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += gridStep) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }

      const groundY = height * 0.84;
      context.strokeStyle = 'rgba(92, 231, 212, 0.35)'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(width * 0.06, groundY); context.lineTo(width * 0.94, groundY); context.stroke();
      context.fillStyle = 'rgba(92, 231, 212, 0.05)'; context.fillRect(width * 0.06, groundY, width * 0.88, height - groundY);

      calculateStress();
      for (const member of model.members) {
        const a = pointToCanvas(model.nodes[member.a], width, height);
        const b = pointToCanvas(model.nodes[member.b], width, height);
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
        context.strokeStyle = stressColor(member.utilization);
        context.lineWidth = 2.5 + Math.min(member.utilization, 1.5) * 1.5;
        context.shadowBlur = member.utilization >= 0.7 ? 8 : 0;
        context.shadowColor = stressColor(member.utilization);
        context.stroke(); context.shadowBlur = 0;
      }

      for (let i = 0; i < model.nodes.length; i += 1) {
        const node = model.nodes[i]; const p = pointToCanvas(node, width, height);
        if (node.load > 0) {
          context.strokeStyle = '#ffcb7a'; context.lineWidth = 2;
          context.beginPath(); context.moveTo(p.x, p.y - 28); context.lineTo(p.x, p.y - 7); context.stroke();
          context.beginPath(); context.moveTo(p.x - 5, p.y - 13); context.lineTo(p.x, p.y - 7); context.lineTo(p.x + 5, p.y - 13); context.stroke();
        }
        context.beginPath(); context.arc(p.x, p.y, node.fixed ? 6 : 4.5, 0, Math.PI * 2);
        context.fillStyle = node.fixed ? '#f3bd68' : (model.selectedNode === i ? '#ffffff' : '#9db7ff');
        context.fill(); context.strokeStyle = '#08111e'; context.lineWidth = 2; context.stroke();
        if (node.fixed) {
          context.fillStyle = 'rgba(243,189,104,.82)';
          context.beginPath(); context.moveTo(p.x - 9, groundY + 2); context.lineTo(p.x + 9, groundY + 2); context.lineTo(p.x, groundY + 12); context.closePath(); context.fill();
        }
      }

      context.font = '11px Inter, sans-serif'; context.fillStyle = 'rgba(220,232,255,.72)';
      context.fillText('MEMBERS — COLOR = AXIAL STRESS', 12, 19);
      context.fillStyle = '#57d7ad'; context.fillRect(12, 28, 12, 3); context.fillStyle = '#dce8ff'; context.fillText('LOW', 29, 33);
      context.fillStyle = '#e7ca68'; context.fillRect(76, 28, 12, 3); context.fillStyle = '#dce8ff'; context.fillText('MED', 93, 33);
      context.fillStyle = '#ff5d70'; context.fillRect(139, 28, 12, 3); context.fillStyle = '#dce8ff'; context.fillText('HIGH / YIELD', 156, 33);
    }

    function applyNodeLoad(node, amount) { node.load += amount; }

    function updatePhysics(dt) {
      if (model.paused) return;
      model.time += dt;
      const damping = 0.985;
      for (const node of model.nodes) {
        if (node.fixed) { node.vx = 0; node.vy = 0; continue; }
        node.fx = 0;
        node.fy = 0.34 + node.load;
      }
      for (const member of model.members) {
        if (member.broken) continue;
        const a = model.nodes[member.a]; const b = model.nodes[member.b];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const length = Math.max(0.0001, Math.hypot(dx, dy));
        const force = member.stiffness * (length - member.rest);
        const fx = force * dx / length; const fy = force * dy / length;
        if (!a.fixed) { a.fx += fx; a.fy += fy; }
        if (!b.fixed) { b.fx -= fx; b.fy -= fy; }
      }
      for (const node of model.nodes) {
        if (node.fixed) continue;
        node.vx = (node.vx + node.fx * dt) * damping;
        node.vy = (node.vy + node.fy * dt) * damping;
        node.x += node.vx * dt;
        node.y += node.vy * dt;
        node.x = clamp(node.x, 0.04, 0.96);
        node.y = clamp(node.y, 0.03, 0.82);
      }
    }

    function nearestNode(x, y, width, height) {
      let best = -1; let bestDistance = Infinity;
      model.nodes.forEach((node, index) => {
        const p = pointToCanvas(node, width, height);
        const distance = Math.hypot(p.x - x, p.y - y);
        if (distance < bestDistance) { bestDistance = distance; best = index; }
      });
      return bestDistance <= 22 ? best : -1;
    }

    function onPointerDown(event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left; const y = event.clientY - rect.top;
      const nodeIndex = nearestNode(x, y, rect.width, rect.height);
      if (model.tool === 'node') {
        const p = canvasToPoint(x, y, rect.width, rect.height);
        model.nodes.push(makeNode(p.x, p.y, false));
        window.FrameLabs3State.updateRuntime({ status: 'New joint added' });
      } else if (model.tool === 'member') {
        if (nodeIndex < 0) { window.FrameLabs3State.updateRuntime({ status: 'Select an existing joint to begin a member' }); }
        else if (model.selectedNode === null) { model.selectedNode = nodeIndex; window.FrameLabs3State.updateRuntime({ status: 'Select the second joint' }); }
        else if (model.selectedNode !== nodeIndex) {
          const a = model.nodes[model.selectedNode]; const b = model.nodes[nodeIndex];
          const exists = model.members.some((m) => (m.a === model.selectedNode && m.b === nodeIndex) || (m.b === model.selectedNode && m.a === nodeIndex));
          if (!exists) model.members.push({ a: model.selectedNode, b: nodeIndex, rest: Math.hypot(b.x - a.x, b.y - a.y), stiffness: 34, axialForce: 0, utilization: 0, broken: false });
          model.selectedNode = null; window.FrameLabs3State.updateRuntime({ status: exists ? 'Member already exists' : 'Structural member added' });
        }
      } else if (model.tool === 'load') {
        if (nodeIndex >= 0 && !model.nodes[nodeIndex].fixed) { applyNodeLoad(model.nodes[nodeIndex], 0.75); window.FrameLabs3State.updateRuntime({ status: 'Downward load applied to joint' }); }
        else window.FrameLabs3State.updateRuntime({ status: 'Loads must be applied to a free joint' });
      } else if (nodeIndex >= 0) {
        model.selectedNode = nodeIndex;
        window.FrameLabs3State.updateRuntime({ status: model.nodes[nodeIndex].fixed ? 'Pinned support selected' : 'Joint selected' });
      } else model.selectedNode = null;
      render();
    }

    function render() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      draw(rect.width, rect.height);
      calculateStress();
      const max = model.maxUtilization;
      const stability = clamp(Math.round(100 - Math.max(0, max - 0.35) * 55), 0, 100);
      window.FrameLabs3State.updateRuntime({
        nodes: model.nodes.length,
        members: model.members.length,
        maxStress: max,
        stability,
        elapsed: model.time,
        status: model.paused ? 'Simulation paused' : window.FrameLabs3State.state.runtime.status
      });
      window.FrameLabs3UI.renderDashboard();
    }

    function step(timestamp) {
      if (!running) return;
      const dt = lastTimestamp ? clamp((timestamp - lastTimestamp) / 1000, 0, 0.033) : 0;
      lastTimestamp = timestamp;
      metricElapsed += dt; metricFrames += 1;
      updatePhysics(dt);
      if (metricElapsed >= 0.25) {
        const fps = metricFrames / metricElapsed;
        const start = performance.now(); calculateStress();
        const solveMs = performance.now() - start;
        window.FrameLabs3State.updateRuntime({ fps: Math.round(fps), latency: solveMs, elapsed: model.time });
        metricElapsed = 0; metricFrames = 0;
      }
      render();
      frameId = requestAnimationFrame(step);
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    return {
      model,
      start() { if (running) return; running = true; lastTimestamp = 0; resize(); render(); frameId = requestAnimationFrame(step); },
      stop() { running = false; if (frameId !== null) cancelAnimationFrame(frameId); frameId = null; },
      resize,
      setTool(tool) { model.tool = tool; model.selectedNode = null; render(); },
      togglePause() { model.paused = !model.paused; window.FrameLabs3State.updateRuntime({ status: model.paused ? 'Simulation paused' : 'Simulation running' }); render(); },
      reset() { const fresh = createModel(window.FrameLabs3State.state.settings.size); model.nodes = fresh.nodes; model.members = fresh.members; model.time = 0; model.selectedNode = null; model.paused = false; window.FrameLabs3State.updateRuntime({ status: 'Starter frame restored' }); render(); },
      focus() { focused = !focused; render(); },
      addLoad() { const freeNode = model.nodes.filter((node) => !node.fixed).sort((a, b) => a.y - b.y)[0]; if (freeNode) applyNodeLoad(freeNode, 0.75); window.FrameLabs3State.updateRuntime({ status: 'Downward load applied to highest free joint' }); render(); }
    };
  }

  window.FrameLabs3Simulation = { createSimulation, instance: null };
})();
