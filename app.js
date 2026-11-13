(() => {
  "use strict";

  function init() {
    const screens = {
      menu: document.getElementById("menuScreen"),
      workspace: document.getElementById("workspaceScreen"),
      settings: document.getElementById("settingsScreen")
    };
    if (Object.values(screens).some((screen) => !screen)) return;

    let currentScreen = "menu";
    let returnScreen = "menu";
    let toastTimer = 0;

    const notify = (message) => {
      const region = document.getElementById("toastRegion");
      if (!region) return;
      region.replaceChildren();
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      region.appendChild(toast);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.remove(), 2600);
    };

    function showScreen(name) {
      if (!screens[name]) return;
      Object.entries(screens).forEach(([key, screen]) => {
        const visible = key === name;
        screen.classList.toggle("active", visible);
        screen.hidden = !visible;
        screen.inert = !visible;
        screen.setAttribute("aria-hidden", String(!visible));
      });
      currentScreen = name;
      if (name === "workspace") requestAnimationFrame(resizeCanvas);
    }

    function openSettings() {
      if (currentScreen !== "settings") returnScreen = currentScreen;
      showScreen("settings");
    }

    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const destination = button.dataset.nav;
        if (destination === "workspace" || destination === "menu") showScreen(destination);
        else if (destination === "settings") openSettings();
        else if (destination === "back") showScreen(returnScreen);
      });
    });

    document.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = document.querySelector('[data-panel="' + tab.dataset.tab + '"]');
        if (!target) return;
        document.querySelectorAll("[data-tab]").forEach((item) => {
          const active = item === tab;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-panel]").forEach((panel) => {
          const active = panel === target;
          panel.classList.toggle("active", active);
          panel.hidden = !active;
        });
      });
    });

    document.querySelectorAll("[data-switch]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const enabled = toggle.getAttribute("aria-checked") !== "true";
        toggle.setAttribute("aria-checked", String(enabled));
        toggle.classList.toggle("on", enabled);
        const label = toggle.querySelector("b");
        if (label) label.textContent = enabled ? (toggle.dataset.mode || "On") : "Off";
      });
    });

    document.querySelectorAll("[data-choice]").forEach((choice) => {
      choice.addEventListener("click", () => {
        document.querySelectorAll('[data-choice="' + choice.dataset.choice + '"]').forEach((item) => {
          item.classList.toggle("chosen", item === choice);
          item.setAttribute("aria-pressed", String(item === choice));
        });
      });
    });

    document.querySelectorAll("[data-range]").forEach((range) => {
      const output = document.querySelector('[data-output="' + range.dataset.range + '"]');
      const update = () => {
        const min = Number(range.min || 0), max = Number(range.max || 100), value = Number(range.value);
        range.style.setProperty("--fill", ((value - min) / Math.max(1, max - min)) * 100 + "%");
        if (output) output.textContent = value + "%";
      };
      range.addEventListener("input", update);
      update();
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        switch (button.dataset.action) {
          case "about": {
            const dialog = document.getElementById("aboutDialog");
            if (dialog && dialog.showModal) dialog.showModal();
            else notify("FrameLabs 3 — browser structural sandbox.");
            break;
          }
          case "reset-view": resetWorld(); notify("View and starter structure reset."); break;
          case "workspace-info": notify("Place nodes, connect them, add loads, and heat members. Right-click a node to pin it."); break;
          default: break;
        }
      });
    });

    // Turn the former static scene illustration into a real canvas workspace.
    const viewport = document.querySelector(".viewport");
    const illustration = viewport && viewport.querySelector(".scene-art");
    if (!viewport || !illustration) return;
    illustration.style.display = "none";

    const canvas = document.createElement("canvas");
    canvas.id = "simulationCanvas";
    canvas.setAttribute("aria-label", "Interactive 2D structural simulation. Use the toolbar to build and test structures.");
    canvas.setAttribute("role", "img");
    viewport.insertBefore(canvas, viewport.querySelector(".hud-top"));

    const toolbar = document.querySelector(".toolbar");
    const toolsSection = toolbar.querySelector(".tool-section");
    toolsSection.innerHTML = `
      <h3><b>01</b> TOOLS <i></i></h3>
      <div class="tool-grid browser-tool-grid">
        <button class="tool selected" data-tool="select" aria-pressed="true"><span>⌖</span><b>Select</b><kbd>1</kbd></button>
        <button class="tool" data-tool="node" aria-pressed="false"><span>＋</span><b>Add node</b><kbd>2</kbd></button>
        <button class="tool" data-tool="member" aria-pressed="false"><span>╱</span><b>Connect</b><kbd>3</kbd></button>
        <button class="tool" data-tool="load" aria-pressed="false"><span>↓</span><b>Add load</b><kbd>4</kbd></button>
        <button class="tool" data-tool="heat" aria-pressed="false"><span>♨</span><b>Heat brush</b><kbd>5</kbd></button>
      </div>
      <p class="browser-hint" id="toolHint">Select nodes or members. Drag a node to reposition it.</p>
      <div class="browser-materials">
        <label for="materialSelect">MEMBER MATERIAL</label>
        <select id="materialSelect">
          <option value="steel">Steel</option><option value="wood">Wood</option>
          <option value="composite">Composite</option><option value="concrete">Concrete</option>
        </select>
      </div>
      <div class="browser-sim-actions">
        <button type="button" id="pauseSimulation">Ⅱ Pause</button>
        <button type="button" id="resetSimulation">↻ Reset</button>
        <button type="button" id="stressToggle" aria-pressed="true">Stress: On</button>
      </div>`;
    const sceneSection = toolbar.querySelectorAll(".tool-section")[1];
    sceneSection.innerHTML = `
      <h3><b>02</b> SCENE <i></i></h3>
      <div class="scene-list">
        <div class="scene-item current"><span>◈</span><b>Environment<small>Browser simulation</small></b><i>●</i></div>
        <div class="scene-item"><span>◇</span><b>Structure<small id="structureCount">9 nodes / 16 members</small></b><i>●</i></div>
        <div class="scene-item"><span>▱</span><b>Ground plane<small>Collision surface</small></b><i>●</i></div>
      </div>`;
    const inspector = toolbar.querySelector(".inspector");
    inspector.innerHTML = `
      <h3><b>03</b> INSPECTOR <i></i></h3>
      <div class="nothing-selected" id="selectionSummary"><span>＋</span><div><b>Nothing selected</b><small>Choose a node or member to inspect it.</small></div></div>
      <div class="property-list" id="selectionProperties">
        <div>NODES <b id="nodeCount">9</b></div><div>MEMBERS <b id="memberCount">16</b></div>
        <div>FAILED <b id="brokenCount">0</b></div><div>LOADS <b id="loadCount">1</b></div>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      #simulationCanvas{position:absolute;z-index:1;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
      .viewport{isolation:isolate}.grid-bg{z-index:0;pointer-events:none}.hud,.axis{pointer-events:none}
      .browser-hint{margin:10px 2px 0;color:#77758f;font-size:8px;line-height:1.5}
      .browser-materials{display:grid;grid-template-columns:1fr;gap:7px;margin-top:15px}
      .browser-materials label{color:#77758f;font-size:7px;font-weight:800;letter-spacing:.13em}
      .browser-materials select{width:100%;height:32px;padding:0 9px;border:1px solid rgba(141,139,205,.17);border-radius:2px;background:#090910;color:#c4c2df;font-size:9px}
      .browser-sim-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
      .browser-sim-actions button{min-height:32px;padding:5px;border:1px solid rgba(141,139,205,.17);border-radius:2px;background:#0c0c14;color:#aaa8c7;font-size:8px}
      .browser-sim-actions button:hover{border-color:#7775c8;color:#fff}
      .browser-sim-actions button[aria-pressed="true"]{border-color:#7775c8;color:#d8d6ff}
      .browser-tool-grid .tool{min-width:0}
      #selectionSummary{min-height:52px}
      @media(max-width:820px){.browser-sim-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);

    const ctx = canvas.getContext("2d");
    // Material response follows FrameLabs 2's shared density/contact model.
    // Values are game tuning, not certified structural-engineering properties.
    // Lower bendStiffness means more elastic bending before the failure threshold.
    const materialProfiles = {
      steel: {
        color: "#aaa8ed", density: 7.8, bend: 0.72, strain: 0.34,
        stiffness: 0.995, bendStiffness: 0.68, heatSoftening: 0.58,
        heatWeakening: 0.78, staticFriction: 0.50, dynamicFriction: 0.30,
        restitution: 0.16, elasticity: 0.78, fatigueSeconds: 4.0
      },
      wood: {
        color: "#bd9870", density: 0.68, bend: 0.42, strain: 0.20,
        stiffness: 0.985, bendStiffness: 0.82, heatSoftening: 0.72,
        heatWeakening: 0.92, staticFriction: 0.76, dynamicFriction: 0.49,
        restitution: 0.12, elasticity: 0.58, fatigueSeconds: 2.5
      },
      composite: {
        color: "#79c6c4", density: 1.25, bend: 0.23, strain: 0.105,
        stiffness: 0.998, bendStiffness: 0.95, heatSoftening: 0.42,
        heatWeakening: 0.86, staticFriction: 0.62, dynamicFriction: 0.38,
        restitution: 0.10, elasticity: 0.32, fatigueSeconds: 3.2
      },
      concrete: {
        color: "#9c9eae", density: 2.35, bend: 0.20, strain: 0.09,
        stiffness: 0.999, bendStiffness: 0.98, heatSoftening: 0.35,
        heatWeakening: 0.90, staticFriction: 0.88, dynamicFriction: 0.64,
        restitution: 0.08, elasticity: 0.25, fatigueSeconds: 2.0
      }
    };
    const state = {
      nodes: [], members: [], loads: [], nextNode: 1, nextMember: 1,
      tool: "select", material: "steel", firstNode: null, selectedNode: null,
      selectedMember: null, dragging: null, paused: false, stress: true,
      lastTime: 0, accumulator: 0, width: 0, height: 0, ground: 0
    };

    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const makeNode = (x, y, pinned = false) => {
      const node = {
        id: state.nextNode++, x, y, px: x, py: y,
        pinned, radius: 5.5, mass: 0.5, inverseMass: pinned ? 0 : 2
      };
      return node;
    };

    function makeLoad(x, y, massKg = 220) {
      const physicalMass = Math.max(0.1, massKg / 100);
      return {
        x, y, px: x, py: y, mass: massKg,
        inverseMass: 1 / physicalMass, radius: 10
      };
    }

    function refreshNodeInverseMass(node) {
      node.inverseMass = node.pinned ? 0 : 1 / Math.max(0.05, node.mass);
    }

    function addMember(a, b, material) {
      if (!a || !b || a === b || state.members.some(m => !m.broken &&
        ((m.a === a && m.b === b) || (m.a === b && m.b === a)))) return null;
      const span = distance(a, b);
      if (span < 18) return null;
      const profile = materialProfiles[material] || materialProfiles.steel;
      const points = [a];
      const memberMass = Math.max(0.1, profile.density * span / 200);
      const endpointMass = memberMass / 10;
      a.mass += endpointMass;
      b.mass += endpointMass;
      refreshNodeInverseMass(a);
      refreshNodeInverseMass(b);
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const point = {
          x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
          px: a.x + (b.x - a.x) * t, py: a.y + (b.y - a.y) * t,
          radius: 2.6, mass: memberMass / 5,
          inverseMass: 1 / Math.max(0.05, memberMass / 5), material
        };
        points.push(point);
      }
      points.push(b);
      state.members.push({
        id: state.nextMember++, a, b, points, material,
        rest: span, segmentRest: span / 5, broken: false,
        stress: 0, damage: 0, fatigue: 0, temperature: 20,
        memberMass
      });
      return state.members[state.members.length - 1];
    }

    function resetWorld() {
      state.nodes = []; state.members = []; state.loads = [];
      state.nextNode = 1; state.nextMember = 1;
      state.firstNode = null; state.selectedNode = null; state.selectedMember = null;
      const w = Math.max(420, canvas.clientWidth), h = Math.max(280, canvas.clientHeight);
      state.width = w; state.height = h;
      const x = [w * .28, w * .50, w * .72], y = [h * .72, h * .43, h * .15];
      const grid = [];
      for (let row = 0; row < 3; row++) {
        grid[row] = [];
        for (let col = 0; col < 3; col++) {
          grid[row][col] = makeNode(x[col], y[row], row === 0);
          state.nodes.push(grid[row][col]);
        }
      }
      const links = [[0,1],[1,2],[3,4],[4,5],[6,7],[7,8],[0,3],[3,6],[1,4],[4,7],[2,5],[5,8],[0,4],[4,8],[2,4],[4,6]];
      links.forEach(([a,b], i) => addMember(state.nodes[a], state.nodes[b], "steel"));
      state.loads.push(makeLoad(w * .50, h * .105, 220));
      state.ground = h * .82;
      updateInspector();
      draw();
    }

    function resizeCanvas() {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const oldW = state.width || rect.width, oldH = state.height || rect.height;
      const sx = rect.width / oldW, sy = rect.height / oldH;
      if (state.width) {
        [...state.nodes, ...state.members.flatMap(m => m.points.slice(1, -1)), ...state.loads].forEach(p => {
          p.x *= sx; p.px *= sx; p.y *= sy; p.py *= sy;
        });
      }
      state.width = rect.width; state.height = rect.height; state.ground = rect.height * .82;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function closestNode(x, y, radius = 18) {
      let found = null, best = radius;
      for (const node of state.nodes) {
        const d = Math.hypot(node.x - x, node.y - y);
        if (d < best) { best = d; found = node; }
      }
      return found;
    }

    function closestMember(x, y, radius = 12) {
      let found = null, best = radius;
      for (const member of state.members) {
        if (member.broken) continue;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = clamp(((x-a.x)*dx + (y-a.y)*dy) / Math.max(1, dx*dx+dy*dy), 0, 1);
          const d = Math.hypot(x - (a.x + dx*t), y - (a.y + dy*t));
          if (d < best) { best = d; found = member; }
        }
      }
      return found;
    }

    function updateInspector() {
      const nodeCount = document.getElementById("nodeCount");
      const memberCount = document.getElementById("memberCount");
      const brokenCount = document.getElementById("brokenCount");
      const loadCount = document.getElementById("loadCount");
      if (nodeCount) nodeCount.textContent = state.nodes.length;
      if (memberCount) memberCount.textContent = state.members.length;
      if (brokenCount) brokenCount.textContent = state.members.filter(m => m.broken).length;
      if (loadCount) loadCount.textContent = state.loads.length;
      const count = document.getElementById("structureCount");
      if (count) count.textContent = state.nodes.length + " nodes / " + state.members.length + " members";
      const summary = document.getElementById("selectionSummary");
      if (!summary) return;
      if (state.selectedNode) {
        summary.innerHTML = "<span>●</span><div><b>Node " + state.selectedNode.id + "</b><small>" +
          (state.selectedNode.pinned ? "Pinned support" : "Dynamic node") + "</small></div>";
      } else if (state.selectedMember) {
        summary.innerHTML = "<span>╱</span><div><b>" + state.selectedMember.material + " member</b><small>" +
          (state.selectedMember.broken ? "Failed" : "Stress " + Math.round(state.selectedMember.stress * 100) + "%") + "</small></div>";
      } else {
        summary.innerHTML = "<span>＋</span><div><b>Nothing selected</b><small>Select a node or member to inspect it.</small></div>";
      }
    }

    function setTool(tool) {
      state.tool = tool; state.firstNode = null;
      document.querySelectorAll("[data-tool]").forEach(button => {
        const active = button.dataset.tool === tool;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const hints = {
        select: "Select nodes or members. Drag a node to reposition it. Right-click a node to pin it.",
        node: "Click empty space to place a new node.",
        member: "Click two existing nodes to connect them with the selected material.",
        load: "Click in the scene to drop a 220 kg test load.",
        heat: "Hold or drag over a member to heat it and weaken its material response."
      };
      document.getElementById("toolHint").textContent = hints[tool];
      canvas.style.cursor = tool === "select" ? "default" : tool === "heat" ? "cell" : "crosshair";
    }

    document.querySelectorAll("[data-tool]").forEach(button => {
      button.addEventListener("click", () => setTool(button.dataset.tool));
    });
    document.getElementById("materialSelect").addEventListener("change", event => {
      state.material = event.target.value;
      notify("New members will use " + state.material + ".");
    });
    document.getElementById("pauseSimulation").addEventListener("click", event => {
      state.paused = !state.paused;
      event.currentTarget.textContent = state.paused ? "▶ Resume" : "Ⅱ Pause";
    });
    document.getElementById("resetSimulation").addEventListener("click", () => {
      resetWorld(); state.paused = false;
      document.getElementById("pauseSimulation").textContent = "Ⅱ Pause";
      notify("Starter structure restored.");
    });
    document.getElementById("stressToggle").addEventListener("click", event => {
      state.stress = !state.stress;
      event.currentTarget.textContent = "Stress: " + (state.stress ? "On" : "Off");
      event.currentTarget.setAttribute("aria-pressed", String(state.stress));
      draw();
    });

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener("contextmenu", event => {
      event.preventDefault();
      const p = pointerPosition(event), node = closestNode(p.x, p.y);
      if (node) { node.pinned = !node.pinned; refreshNodeInverseMass(node); node.px = node.x; node.py = node.y; updateInspector(); draw(); }
    });
    canvas.addEventListener("pointerdown", event => {
      const p = pointerPosition(event);
      if (event.button === 2) return;
      canvas.setPointerCapture(event.pointerId);
      if (state.tool === "node") {
        state.nodes.push(makeNode(p.x, p.y)); updateInspector(); draw(); return;
      }
      if (state.tool === "member") {
        const node = closestNode(p.x, p.y, 22);
        if (!node) { notify("Connect members by clicking two nodes."); return; }
        if (!state.firstNode) {
          state.firstNode = node; notify("First node selected. Choose the second node."); draw();
        } else {
          const member = addMember(state.firstNode, node, state.material);
          state.firstNode = null;
          if (!member) notify("Those nodes cannot be connected.");
          updateInspector(); draw();
        }
        return;
      }
      if (state.tool === "load") {
        state.loads.push(makeLoad(p.x, p.y, 220));
        updateInspector(); draw(); return;
      }
      if (state.tool === "heat") { applyHeat(p.x, p.y, .04); return; }
      const node = closestNode(p.x, p.y);
      const member = node ? null : closestMember(p.x, p.y);
      state.selectedNode = node; state.selectedMember = member;
      if (node && !node.pinned) state.dragging = node;
      updateInspector(); draw();
    });
    canvas.addEventListener("pointermove", event => {
      const p = pointerPosition(event);
      if (state.dragging) {
        state.dragging.x = p.x; state.dragging.y = p.y;
        state.dragging.px = p.x; state.dragging.py = p.y;
        draw();
      } else if (state.tool === "heat" && event.buttons === 1) applyHeat(p.x, p.y, .025);
    });
    const endDrag = () => { state.dragging = null; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    function applyHeat(x, y, amount) {
      for (const member of state.members) {
        if (member.broken) continue;
        let nearest = Infinity;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i-1], b = member.points[i], dx = b.x-a.x, dy = b.y-a.y;
          const t = clamp(((x-a.x)*dx+(y-a.y)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
          nearest = Math.min(nearest, Math.hypot(x-a.x-dx*t,y-a.y-dy*t));
        }
        if (nearest < 36) member.temperature = Math.min(1000, member.temperature + amount * (1-nearest/36));
      }
      draw();
    }

    function solveConstraint(a, b, rest, stiffness) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthNow = Math.hypot(dx, dy);
      if (lengthNow < 0.001) return;
      const wa = Math.max(0, a.inverseMass || 0);
      const wb = Math.max(0, b.inverseMass || 0);
      const weight = wa + wb;
      if (weight <= 0) return;
      const correction = ((lengthNow - rest) / lengthNow) * clamp(stiffness, 0, 1);
      const ox = dx * correction, oy = dy * correction;
      a.x += ox * wa / weight; a.y += oy * wa / weight;
      b.x -= ox * wb / weight; b.y -= oy * wb / weight;
    }

    function velocityOf(p, dt) {
      return { x: (p.x - p.px) / dt, y: (p.y - p.py) / dt };
    }

    function applyImpulse(p, impulseX, impulseY, dt) {
      if (!p.inverseMass || dt <= 0) return;
      const velocity = velocityOf(p, dt);
      velocity.x += impulseX * p.inverseMass;
      velocity.y += impulseY * p.inverseMass;
      p.px = p.x - velocity.x * dt;
      p.py = p.y - velocity.y * dt;
    }

    function integrateParticle(p, dt, profile = materialProfiles.concrete) {
      if (p.pinned || p === state.dragging) {
        p.px = p.x; p.py = p.y;
        return;
      }
      const damping = Math.pow(0.998, dt * 120);
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x; p.py = p.y;
      p.x += vx;
      p.y += vy + 620 * dt * dt;

      if (p.y > state.ground) {
        p.y = state.ground;
        const materialFriction = profile || materialProfiles.concrete;
        let velocityX = (p.x - p.px) / dt;
        const velocityY = (p.y - p.py) / dt;
        const groundProfile = materialProfiles.concrete;
        const staticFriction = (materialFriction.staticFriction + groundProfile.staticFriction) * 0.5;
        const dynamicFriction = (materialFriction.dynamicFriction + groundProfile.dynamicFriction) * 0.5;
        const stopSpeed = staticFriction * 620 * dt;
        if (Math.abs(velocityX) <= stopSpeed) velocityX = 0;
        else velocityX -= Math.sign(velocityX) * dynamicFriction * 620 * dt;
        const restitution = Math.min(0.35, (materialFriction.restitution + groundProfile.restitution) * 0.5);
        const reboundY = velocityY > 0 ? -velocityY * restitution : 0;
        p.px = p.x - velocityX * dt;
        p.py = p.y - reboundY * dt;
      }
    }

    function solveLoadMemberContact(load, member, dt, solveVelocity) {
      if (member.broken) return;
      const profile = materialProfiles[member.material];
      for (let i = 1; i < member.points.length; i++) {
        const a = member.points[i - 1], b = member.points[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const denominator = dx * dx + dy * dy;
        const t = clamp(((load.x - a.x) * dx + (load.y - a.y) * dy) /
          Math.max(1, denominator), 0, 1);
        const qx = a.x + dx * t, qy = a.y + dy * t;
        const deltaX = load.x - qx, deltaY = load.y - qy;
        const distanceNow = Math.hypot(deltaX, deltaY);
        const minimumDistance = load.radius + Math.max(2.6, a.radius || 0, b.radius || 0);
        if (distanceNow >= minimumDistance) continue;

        const normalX = distanceNow > 0.001 ? deltaX / distanceNow : 0;
        const normalY = distanceNow > 0.001 ? deltaY / distanceNow : -1;
        const invLoad = load.inverseMass;
        const invA = (a.inverseMass || 0) * (1 - t) * (1 - t);
        const invB = (b.inverseMass || 0) * t * t;
        const inverseMassSum = invLoad + invA + invB;
        if (inverseMassSum <= 1e-8) continue;
        const penetration = minimumDistance - distanceNow;
        a.x -= normalX * penetration * (a.inverseMass || 0) * (1 - t) / inverseMassSum;
        a.y -= normalY * penetration * (a.inverseMass || 0) * (1 - t) / inverseMassSum;
        b.x -= normalX * penetration * (b.inverseMass || 0) * t / inverseMassSum;
        b.y -= normalY * penetration * (b.inverseMass || 0) * t / inverseMassSum;
        load.x += normalX * penetration * invLoad / inverseMassSum;
        load.y += normalY * penetration * invLoad / inverseMassSum;

        if (!solveVelocity || dt <= 0) continue;
        let va = velocityOf(a, dt), vb = velocityOf(b, dt), vl = velocityOf(load, dt);
        let vmx = va.x * (1 - t) + vb.x * t;
        let vmy = va.y * (1 - t) + vb.y * t;
        let relativeX = vl.x - vmx, relativeY = vl.y - vmy;
        const closingSpeed = relativeX * normalX + relativeY * normalY;
        let normalImpulse = 0;
        if (closingSpeed < 0) {
          normalImpulse = -(1 + profile.restitution) * closingSpeed / inverseMassSum;
          applyImpulse(load, normalX * normalImpulse, normalY * normalImpulse, dt);
          applyImpulse(a, -normalX * normalImpulse * (1 - t), -normalY * normalImpulse * (1 - t), dt);
          applyImpulse(b, -normalX * normalImpulse * t, -normalY * normalImpulse * t, dt);
        }

        va = velocityOf(a, dt); vb = velocityOf(b, dt); vl = velocityOf(load, dt);
        vmx = va.x * (1 - t) + vb.x * t;
        vmy = va.y * (1 - t) + vb.y * t;
        relativeX = vl.x - vmx; relativeY = vl.y - vmy;
        const tangentX = -normalY, tangentY = normalX;
        const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
        if (Math.abs(tangentSpeed) > 1e-5) {
          const mu = Math.abs(tangentSpeed) < 0.12 ? profile.staticFriction : profile.dynamicFriction;
          const limit = normalImpulse * clamp(mu, 0, 1.2);
          const tangentImpulse = clamp(-tangentSpeed / inverseMassSum, -limit, limit);
          applyImpulse(load, tangentX * tangentImpulse, tangentY * tangentImpulse, dt);
          applyImpulse(a, -tangentX * tangentImpulse * (1 - t), -tangentY * tangentImpulse * (1 - t), dt);
          applyImpulse(b, -tangentX * tangentImpulse * t, -tangentY * tangentImpulse * t, dt);
        }
      }
    }

    function physicsStep(dt) {
      for (const node of state.nodes) integrateParticle(node, dt, materialProfiles.concrete);
      for (const member of state.members) {
        const profile = materialProfiles[member.material];
        for (let i = 1; i < member.points.length - 1; i++) {
          integrateParticle(member.points[i], dt, profile);
        }
      }
      for (const load of state.loads) integrateParticle(load, dt, materialProfiles.concrete);

      const solverIterations = 14;
      for (let iteration = 0; iteration < solverIterations; iteration++) {
        for (const member of state.members) {
          if (member.broken) continue;
          const profile = materialProfiles[member.material];
          const heat = clamp((member.temperature - 20) / 850, 0, 1);
          const stiffness = profile.stiffness * (1 - profile.heatSoftening * heat);
          const bendStiffness = profile.bendStiffness * (1 - profile.heatSoftening * heat);
          for (let i = 1; i < member.points.length; i++) {
            solveConstraint(member.points[i - 1], member.points[i], member.segmentRest, stiffness);
          }
          for (let i = 1; i + 1 < member.points.length; i++) {
            solveConstraint(member.points[i - 1], member.points[i + 1],
              member.segmentRest * 2, bendStiffness);
          }
        }
        for (const load of state.loads) {
          for (const member of state.members) {
            solveLoadMemberContact(load, member, dt, iteration === solverIterations - 1);
          }
        }
      }

      for (const member of state.members) {
        if (member.broken) continue;
        const profile = materialProfiles[member.material];
        let currentLength = 0, maxAngle = 0;
        for (let i = 1; i < member.points.length; i++) {
          currentLength += distance(member.points[i - 1], member.points[i]);
        }
        for (let i = 1; i + 1 < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i], c = member.points[i + 1];
          const angleA = Math.atan2(b.y - a.y, b.x - a.x);
          const angleB = Math.atan2(c.y - b.y, c.x - b.x);
          let angle = Math.abs(angleB - angleA);
          if (angle > Math.PI) angle = 2 * Math.PI - angle;
          maxAngle = Math.max(maxAngle, angle);
        }

        const excessTemperature = Math.max(0, member.temperature - 20);
        const heat = clamp(excessTemperature / 850, 0, 1);
        const strengthFactor = 1 - profile.heatWeakening * heat;
        const bendingCapacity = Math.max(0.08, profile.bend * strengthFactor);
        const axialCapacity = Math.max(0.03, profile.strain * strengthFactor);
        const strain = Math.abs(currentLength - member.rest) / Math.max(1, member.rest);
        member.stress = Math.max(strain / axialCapacity, maxAngle / bendingCapacity);
        if (member.stress > 0.72) member.fatigue += dt * (member.stress - 0.68) * 0.42;
        else member.fatigue = Math.max(0, member.fatigue - dt * 0.08);
        member.damage = clamp(member.damage + Math.max(0, member.stress - 0.85) * dt * 0.16, 0, 0.99);
        if (member.stress > 1.12 || member.fatigue > profile.fatigueSeconds) member.broken = true;
        member.temperature = Math.max(20, member.temperature - dt * 1.5);
      }
    }

    function draw() {
      if (!ctx || !state.width || !state.height) return;
      const w=state.width,h=state.height;
      ctx.clearRect(0,0,w,h);
      // Ground baseline.
      ctx.save();
      ctx.strokeStyle="rgba(160,157,220,.34)";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,state.ground+1);ctx.lineTo(w,state.ground+1);ctx.stroke();
      ctx.restore();
      for (const member of state.members) {
        const profile=materialProfiles[member.material];
        let color=profile.color;
        if (member.broken) color="#777184";
        else if (state.stress) {
          const s=clamp(member.stress,0,1);
          color=s<.5 ? "rgb("+Math.round(80+45*s*2)+","+Math.round(185+20*s*2)+","+Math.round(205-25*s*2)+")"
            : "rgb("+Math.round(125+125*(s-.5)*2)+","+Math.round(205-145*(s-.5)*2)+","+Math.round(180-130*(s-.5)*2)+")";
        }
        ctx.strokeStyle=color;ctx.lineWidth=6;ctx.lineCap="round";ctx.lineJoin="round";
        ctx.beginPath();ctx.moveTo(member.points[0].x,member.points[0].y);
        for(let i=1;i<member.points.length;i++)ctx.lineTo(member.points[i].x,member.points[i].y);
        ctx.stroke();
        if (member.temperature>80 && !member.broken) {
          ctx.strokeStyle="rgba(255,139,78,.28)";ctx.lineWidth=12;ctx.stroke();
        }
        if (member===state.selectedMember) {
          ctx.strokeStyle="#f0efff";ctx.lineWidth=2;ctx.setLineDash([5,4]);
          ctx.stroke();ctx.setLineDash([]);
        }
      }
      for (const load of state.loads) {
        ctx.fillStyle="#e8ad70";ctx.beginPath();ctx.arc(load.x,load.y,load.radius,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="#f4d2a9";ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle="#f1e8d9";ctx.font="10px system-ui";ctx.fillText(Math.round(load.mass)+" kg",load.x+14,load.y-9);
      }
      for (const node of state.nodes) {
        ctx.fillStyle=node.pinned?"#efc278":node===state.selectedNode?"#fff":"#c2bfff";
        ctx.beginPath();ctx.arc(node.x,node.y,node===state.selectedNode?7:5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle="#242342";ctx.lineWidth=2;ctx.stroke();
        if(node===state.firstNode){ctx.strokeStyle="#aaa6ff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(node.x,node.y,13,0,Math.PI*2);ctx.stroke();}
      }
      if(state.tool==="heat" && state.pointer) {
        ctx.strokeStyle="rgba(255,145,91,.5)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(state.pointer.x,state.pointer.y,36,0,Math.PI*2);ctx.stroke();
      }
      updateInspector();
      const status=document.querySelector(".view-status span:first-child");
      if(status) status.innerHTML="<i></i> "+(state.paused?"PAUSED":"LIVE PHYSICS")+" &nbsp; / &nbsp; "+state.nodes.length+" NODES";
    }

    function frame(time) {
      if (!state.lastTime) state.lastTime = time;
      const frameDelta = clamp((time - state.lastTime) / 1000, 0, 0.1);
      state.lastTime = time;
      if (!state.paused && currentScreen === "workspace") {
        const fixedStep = 1 / 120;
        state.accumulator = Math.min(0.1, state.accumulator + frameDelta);
        let steps = 0;
        while (state.accumulator >= fixedStep && steps < 12) {
          physicsStep(fixedStep);
          state.accumulator -= fixedStep;
          steps++;
        }
        if (steps === 12) state.accumulator = 0;
      } else {
        state.accumulator = 0;
      }
      draw();
      requestAnimationFrame(frame);
    }

    canvas.addEventListener("pointermove", event => {
      state.pointer=pointerPosition(event);
    });
    resetWorld();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("keydown", event => {
      if(event.key==="Escape" && currentScreen==="workspace"){showScreen("menu");return;}
      if(event.key==="Escape" && currentScreen==="settings"){showScreen(returnScreen);return;}
      if(currentScreen!=="workspace" || event.ctrlKey || event.metaKey || event.altKey) return;
      const shortcuts={"1":"select","2":"node","3":"member","4":"load","5":"heat"};
      if(shortcuts[event.key]) setTool(shortcuts[event.key]);
      if(event.code==="Space" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        event.preventDefault();
        document.getElementById("pauseSimulation").click();
      }
      if(event.key.toLowerCase()==="r" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        resetWorld(); notify("Starter structure restored.");
      }
    });
    showScreen("menu");
    requestAnimationFrame(frame);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();