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
          case "reset-view": resizeCanvas(); draw(); notify("Viewport refreshed."); break;
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
        <button class="tool" data-tool="rope" aria-pressed="false"><span>≈</span><b>Rope</b><kbd>T</kbd></button>
        <button class="tool" data-tool="load" aria-pressed="false"><span>↓</span><b>Add load</b><kbd>4</kbd></button>
        <button class="tool" data-tool="heat" aria-pressed="false"><span>♨</span><b>Heat brush</b><kbd>5</kbd></button>
        <button class="tool" data-tool="delete" aria-pressed="false"><span>⌫</span><b>Delete</b><kbd>6</kbd></button>
        <button class="tool" data-tool="break" aria-pressed="false"><span>⚡</span><b>Break</b><kbd>7</kbd></button>
        <button class="tool" data-tool="explode" aria-pressed="false"><span>✹</span><b>Explode</b><kbd>8</kbd></button>
        <button class="tool" data-tool="ignite" aria-pressed="false"><span>♨</span><b>Ignite</b><kbd>9</kbd></button>
        <button class="tool" data-tool="ladder" aria-pressed="false"><span>↕</span><b>Ladder</b><kbd>L</kbd></button>
        <button class="tool" data-tool="stairs" aria-pressed="false"><span>⌁</span><b>Stairs</b><kbd>S</kbd></button>
        <button class="tool" data-tool="elevator" aria-pressed="false"><span>⇵</span><b>Elevator</b><kbd>E</kbd></button>
        <button class="tool" data-tool="exit" aria-pressed="false"><span>⇥</span><b>Exit</b><kbd>X</kbd></button>
      </div>
      <p class="browser-hint" id="toolHint">Build your structure first. Pin supports with right-click, then press Start Test.</p>
      <p class="browser-hint">WORLD SCALE · 1 GRID CELL = 5 ft² (2.236 ft × 2.236 ft)</p>
      <div class="browser-materials">
        <label for="materialSelect">MEMBER MATERIAL</label>
        <select id="materialSelect">
          <option value="steel">Steel</option><option value="wood">Wood</option>
          <option value="composite">Composite</option><option value="explosiveComposite">Explosive composite</option>
          <option value="flammableComposite">Flammable composite</option><option value="concrete">Concrete</option>
        </select>
      </div>
      <div class="browser-sim-actions">
        <button type="button" id="startTestSimulation" title="Start or pause the structural test">▶ Start Test</button>
        <button type="button" id="resetStructure" title="Restore the structure exactly as it was before the latest test" disabled>↻ Reset Structure</button>
        <button type="button" id="stressToggle" aria-pressed="true">Stress: On</button>
        <button type="button" id="gridSnapToggle" aria-pressed="false">Grid snap: Off</button>
        <button type="button" id="clearScene" class="clear-scene-action">Clear scene</button>
      </div>
      <div class="browser-population">
        <label>OCCUPANT POPULATION</label>
        <div class="browser-population-actions">
          <button type="button" id="spawnOccupants" disabled>＋ Spawn 12</button>
          <button type="button" id="clearOccupants" disabled>Clear</button>
        </div>
        <p id="populationStatus">0 occupants · Start a test and place an exit to enable.</p>
      </div>`;
    const sceneSection = toolbar.querySelectorAll(".tool-section")[1];
    sceneSection.innerHTML = `
      <h3><b>02</b> SCENE <i></i></h3>
      <div class="scene-list">
        <div class="scene-item current"><span>◈</span><b>Environment<small>Browser simulation</small></b><i>●</i></div>
        <div class="scene-item"><span>◇</span><b>Structure<small id="structureCount">0 nodes / 0 members</small></b><i>●</i></div>
        <div class="scene-item"><span>▱</span><b>Ground plane<small>Collision surface</small></b><i>●</i></div>
      </div>`;
    const inspector = toolbar.querySelector(".inspector");
    inspector.innerHTML = `
      <h3><b>03</b> INSPECTOR <i></i></h3>
      <div class="nothing-selected" id="selectionSummary"><span>＋</span><div><b>Nothing selected</b><small>Choose a node or member to inspect it.</small></div></div>
      <div class="property-list" id="selectionProperties">
        <div>NODES <b id="nodeCount">0</b></div><div>MEMBERS <b id="memberCount">0</b></div>
        <div>FAILED <b id="brokenCount">0</b></div><div>LOADS <b id="loadCount">0</b></div>
        <div>DEBRIS <b id="debrisCount">0</b></div><div>PARTICLES <b id="particleCount">0</b></div>
        <div>CONNECTORS <b id="connectorCount">0</b></div><div>EXITS <b id="exitCount">0</b></div>
        <div>OCCUPANTS <b id="occupantCount">0</b></div><div>EVACUATED <b id="evacuatedCount">0</b></div>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      #simulationCanvas{position:absolute;z-index:1;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
      .viewport{isolation:isolate}.grid-bg{z-index:0;pointer-events:none}.hud,.axis{pointer-events:none}
      .toolbar{overflow-y:auto;overscroll-behavior:contain}
      .browser-hint{margin:10px 2px 0;color:#77758f;font-size:8px;line-height:1.5}
      .browser-materials{display:grid;grid-template-columns:1fr;gap:7px;margin-top:15px}
      .browser-materials label{color:#77758f;font-size:7px;font-weight:800;letter-spacing:.13em}
      .browser-materials select{width:100%;height:32px;padding:0 9px;border:1px solid rgba(141,139,205,.17);border-radius:2px;background:#090910;color:#c4c2df;font-size:9px}
      .browser-sim-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px}
      .browser-sim-actions button{min-height:32px;padding:5px;border:1px solid rgba(141,139,205,.17);border-radius:2px;background:#0c0c14;color:#aaa8c7;font-size:8px}
      .browser-sim-actions button:hover{border-color:#7775c8;color:#fff}
      .browser-sim-actions button[aria-pressed="true"]{border-color:#7775c8;color:#d8d6ff}
      .browser-sim-actions button:disabled,.browser-tool-grid .tool:disabled{opacity:.38;cursor:not-allowed}
      .browser-sim-actions button:disabled:hover,.browser-tool-grid .tool:disabled:hover{border-color:rgba(141,139,205,.17);color:#77758f}
      .browser-sim-actions .clear-scene-action{grid-column:1/-1;border-color:rgba(190,104,111,.38);color:#d59a9f}
      .browser-sim-actions .clear-scene-action:hover{border-color:#c87982;color:#ffe0e2}
      .browser-population{display:grid;gap:7px;margin-top:14px;padding-top:11px;border-top:1px solid rgba(141,139,205,.14)}
      .browser-population>label{color:#77758f;font-size:7px;font-weight:800;letter-spacing:.13em}
      .browser-population-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .browser-population-actions button{min-height:30px;border:1px solid rgba(141,139,205,.17);border-radius:2px;background:#0c0c14;color:#aaa8c7;font-size:8px}
      .browser-population-actions button:hover{border-color:#7775c8;color:#fff}
      .browser-population-actions button:disabled{opacity:.38;cursor:not-allowed}
      #populationStatus{margin:0;color:#77758f;font-size:8px;line-height:1.5}
      .browser-tool-grid .tool{min-width:0;min-height:36px}
      .browser-tool-grid .tool b{font-size:9px}
      #selectionSummary{min-height:52px}
      .workspace-screen .grid-bg{background-size:24px 24px;background-position:0 0}
      @media(max-width:820px){.browser-sim-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);

    const ctx = canvas.getContext("2d");
    if (!window.FrameLabs3WorldSystems) {
      notify("World systems did not load. Refresh the FL3 preview.");
      return;
    }
    const worldSystems = window.FrameLabs3WorldSystems.createWorldSystems();
    window.FrameLabs3Navigation = Object.freeze({
      findRouteToExit: (x, y) => worldSystems.findRouteToExit(x, y, state.ground),
      getOccupantPerception: (x, y, extras = {}) =>
        worldSystems.occupantPerception(x, y, extras, {
          ground: state.ground, members: state.members
        }),
      addConnector: (kind, a, b) => worldSystems.addConnector(kind, a, b),
      addExit: point => worldSystems.addExit(point)
    });
    // One 24 px grid cell represents 5 square feet of plan area.
    // Physics is simulated in canvas pixels, with physical constants converted from SI.
    const GRID_CELL_PX = 24;
    const GRID_CELL_AREA_FT2 = 5;
    const GRID_CELL_SIDE_FEET = Math.sqrt(GRID_CELL_AREA_FT2);
    const METERS_PER_GRID_CELL = GRID_CELL_SIDE_FEET * 0.3048;
    const METERS_PER_PIXEL = METERS_PER_GRID_CELL / GRID_CELL_PX;
    const GRAVITY_PX_S2 = 9.80665 / METERS_PER_PIXEL;
    const REFERENCE_MEMBER_AREA_M2 = 0.000367;
    // Material density values are stored as g/cm³ and converted to kg/m³.
    // This reference cross-section preserves the former mass scale while
    // making mass consistent with the stated real-world grid dimensions.
    // Material response follows FrameLabs 2's shared density/contact model.
    // Values are game tuning, not certified structural-engineering properties.
    // Lower bendStiffness means more elastic bending before the failure threshold.
    const materialProfiles = {
      steel: {
        color: "#aaa8ed", density: 7.8, bend: 0.95, strain: 0.11,
        stiffness: 0.995, bendStiffness: 0.975, heatSoftening: 0.58,
        heatWeakening: 0.78, thermalExpansion: 0.000035, tensileYield: 0.018, plasticRate: 1.2,
        staticFriction: 0.50, dynamicFriction: 0.30,
        restitution: 0.16, elasticity: 0.78, fatigueSeconds: 4.0
      },
      wood: {
        color: "#bd9870", density: 0.68, bend: 0.42, strain: 0.065,
        stiffness: 0.985, bendStiffness: 0.985, heatSoftening: 0.72,
        heatWeakening: 0.92, thermalExpansion: 0.000018, tensileYield: 0.012, plasticRate: 0.6,
        staticFriction: 0.76, dynamicFriction: 0.49,
        restitution: 0.12, elasticity: 0.58, fatigueSeconds: 2.5,
        flammability: 0.82, ignitionTemperature: 225, burnRate: 105
      },
      composite: {
        color: "#79c6c4", density: 1.25, bend: 0.23, strain: 0.03,
        stiffness: 0.998, bendStiffness: 0.994, heatSoftening: 0.42,
        heatWeakening: 0.86, thermalExpansion: 0.00001, tensileYield: 0.006, plasticRate: 0.6,
        staticFriction: 0.62, dynamicFriction: 0.38,
        restitution: 0.10, elasticity: 0.32, fatigueSeconds: 3.2,
        flammability: 0, ignitionTemperature: 10000
      },
      concrete: {
        color: "#9c9eae", density: 2.35, bend: 0.20, strain: 0.025,
        stiffness: 0.999, bendStiffness: 0.997, heatSoftening: 0.35,
        heatWeakening: 0.90, thermalExpansion: 0.00001, tensileYield: 0.004, plasticRate: 0.4,
        staticFriction: 0.88, dynamicFriction: 0.64,
        restitution: 0.08, elasticity: 0.25, fatigueSeconds: 2.0,
        flammability: 0, ignitionTemperature: 10000
      },
      explosiveComposite: {
        color: "#d88d65", density: 1.35, bend: 0.20, strain: 0.028,
        stiffness: 0.998, bendStiffness: 0.995, heatSoftening: 0.48,
        heatWeakening: 0.92, thermalExpansion: 0.00001, tensileYield: 0.006, plasticRate: 0.45,
        staticFriction: 0.60, dynamicFriction: 0.36,
        restitution: 0.12, elasticity: 0.35, fatigueSeconds: 2.5,
        flammability: 0.65, ignitionTemperature: 270, burnRate: 180, explosive: true
      },
      flammableComposite: {
        color: "#cc9857", density: 1.20, bend: 0.22, strain: 0.03,
        stiffness: 0.997, bendStiffness: 0.993, heatSoftening: 0.58,
        heatWeakening: 0.95, thermalExpansion: 0.000012, tensileYield: 0.006, plasticRate: 0.5,
        staticFriction: 0.63, dynamicFriction: 0.39,
        restitution: 0.10, elasticity: 0.30, fatigueSeconds: 2.6,
        flammability: 1, ignitionTemperature: 150, burnRate: 145
      }
    };
    const state = {
      nodes: [], members: [], loads: [], nextNode: 1, nextMember: 1,
      tool: "select", material: "steel", firstNode: null, selectedNode: null,
      selectedMember: null, selectedLoad: null, dragging: null, paused: true,
      firstNavPoint: null, testMode: false, testSnapshot: null,
      stress: true, gridSnap: false, gridSize: GRID_CELL_PX,
      lastTime: 0, accumulator: 0, width: 0, height: 0, ground: 0
    };
    const occupantSimulation = window.FrameLabs3OccupantSimulation && window.FrameLabs3AgentFive
      ? window.FrameLabs3OccupantSimulation.createPopulationSimulation({
          agentApi: window.FrameLabs3AgentFive, worldSystems
        }) : null;
    if (occupantSimulation) {
      window.FrameLabs3Population = Object.freeze({
        spawn: count => occupantSimulation.spawn(count, { width: state.width, ground: state.ground }),
        clear: () => occupantSimulation.clear(),
        getOccupants: () => occupantSimulation.getOccupants()
      });
    }

    const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const makeNode = (x, y, pinned = false, baseNode = false) => {
      const node = {
        id: state.nextNode++, x, y, px: x, py: y,
        pinned: pinned || baseNode, baseNode, radius: 5.5, baseMass: 0.5, mass: 0.5, inverseMass: (pinned || baseNode) ? 0 : 2
      };
      return node;
    };

    function makeLoad(x, y, massKg = 220) {
      const physicalMass = Math.max(0.1, massKg);
      return {
        x, y, px: x, py: y, mass: massKg,
        inverseMass: 1 / physicalMass, radius: 10
      };
    }

    function refreshNodeInverseMass(node) {
      node.inverseMass = node.pinned ? 0 : 1 / Math.max(0.05, node.mass);
    }

    function recalculateNodeMasses() {
      for (const node of state.nodes) {
        node.mass = node.baseMass || 0.5;
      }
      for (const member of state.members) {
        if (member.broken || member.detached) continue;
        const endpointMass = Math.max(0, member.memberMass || 0) / 10;
        member.a.mass += endpointMass;
        member.b.mass += endpointMass;
      }
      for (const node of state.nodes) refreshNodeInverseMass(node);
    }

    function addMember(a, b, material, kind = "beam") {
      if (!a || !b || a === b || state.members.some(m => !m.broken && (m.kind || "beam") === kind &&
        ((m.a === a && m.b === b) || (m.a === b && m.b === a)))) return null;
      const span = distance(a, b);
      if (span < 18) return null;
      const profile = materialProfiles[material] || materialProfiles.steel;
      const sagClearance = Math.max(0, state.ground - Math.max(a.y, b.y) - 4);
      const sag = kind === "rope" ? Math.min(span * 0.18, sagClearance) : 0;
      const points = [a];
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + 4 * t * (1 - t) * sag;
        points.push({ x, y, px: x, py: y, radius: 2.6, mass: 0, inverseMass: 0, material });
      }
      points.push(b);
      const initialSegmentLengths = [];
      let initialArcLength = 0;
      for (let i = 1; i < points.length; i++) {
        const segmentLength = distance(points[i - 1], points[i]);
        initialSegmentLengths.push(segmentLength);
        initialArcLength += segmentLength;
      }
      const slack = kind === "rope" ? 1.04 : 1;
      const rest = kind === "rope" ? initialArcLength * slack : span;
      const segmentRests = initialSegmentLengths.map(length => length * slack);
      const memberMass = Math.max(
        0.1,
        profile.density * 1000 * REFERENCE_MEMBER_AREA_M2 *
          (kind === "rope" ? initialArcLength : span) * METERS_PER_PIXEL
      );
      const endpointMass = memberMass / 10;
      a.mass += endpointMass;
      b.mass += endpointMass;
      refreshNodeInverseMass(a);
      refreshNodeInverseMass(b);
      for (let i = 1; i < points.length - 1; i++) {
        points[i].mass = memberMass / 5;
        points[i].inverseMass = 1 / Math.max(0.05, points[i].mass);
      }
      state.members.push({
        id: state.nextMember++, a, b, points, material, kind,
        rest, segmentRest: rest / 5, segmentRests,
        broken: false, detached: false, fractureProcessed: false,
        ignited: false, exploded: false, fireTimer: 0, smokeTimer: 0,
        stress: 0, damage: 0, fatigue: 0, temperature: 20,
        plasticStrain: 0, peakTensileStrain: 0, memberMass
      });
      return state.members[state.members.length - 1];
    }


    // Convert build-time member crossings into shared structural joints before
    // physics starts. This prevents two beams that begin in the same space from
    // being treated as unrelated bodies that must push one another apart.
    function memberIntersection(first, second) {
      const ax = first.a.x, ay = first.a.y;
      const rx = first.b.x - ax, ry = first.b.y - ay;
      const cx = second.a.x, cy = second.a.y;
      const sx = second.b.x - cx, sy = second.b.y - cy;
      const denominator = rx * sy - ry * sx;
      const scale = Math.max(1, Math.hypot(rx, ry) * Math.hypot(sx, sy));
      if (Math.abs(denominator) <= 1e-8 * scale) return null;

      const qx = cx - ax, qy = cy - ay;
      const t = (qx * sy - qy * sx) / denominator;
      const u = (qx * ry - qy * rx) / denominator;
      const epsilon = 1e-7;
      if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;
      const clampedT = clamp(t, 0, 1);
      return {
        t: clampedT,
        u: clamp(u, 0, 1),
        x: ax + rx * clampedT,
        y: ay + ry * clampedT
      };
    }

    function projectMemberParameter(member, point) {
      const dx = member.b.x - member.a.x;
      const dy = member.b.y - member.a.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 1e-8) return 0;
      return clamp(((point.x - member.a.x) * dx + (point.y - member.a.y) * dy) / lengthSquared, 0, 1);
    }

    function createMemberFragment(source, a, b, startT, endT, keepOriginalId) {
      const span = distance(a, b);
      if (span < 0.5 || endT - startT < 1e-5) return null;
      const kind = source.kind || "beam";
      const isRope = kind === "rope";
      const rest = Math.max(0.5, source.rest * (endT - startT));
      const originalMass = source.memberMass || (
        materialProfiles[source.material].density * 1000 * REFERENCE_MEMBER_AREA_M2 *
        source.rest * METERS_PER_PIXEL
      );
      const memberMass = Math.max(0.01, originalMass * (endT - startT));
      const sagClearance = Math.max(0, state.ground - Math.max(a.y, b.y) - 4);
      const sag = isRope ? Math.min(distance(a, b) * 0.18, sagClearance) : 0;
      const points = [a];
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + 4 * t * (1 - t) * sag;
        points.push({
          x, y, px: x, py: y, radius: 2.6,
          mass: memberMass / 5,
          inverseMass: 1 / Math.max(0.05, memberMass / 5),
          material: source.material
        });
      }
      points.push(b);
      const segmentRests = [];
      for (let i = 1; i < points.length; i++) {
        segmentRests.push(distance(points[i - 1], points[i]) * (isRope ? 1.04 : 1));
      }
      return {
        id: keepOriginalId ? source.id : state.nextMember++,
        a, b, points, material: source.material, kind,
        rest: isRope ? segmentRests.reduce((sum, value) => sum + value, 0) : rest,
        segmentRest: rest / 5, segmentRests, broken: false,
        stress: source.stress || 0,
        damage: source.damage || 0,
        fatigue: source.fatigue || 0,
        temperature: source.temperature || 20,
        plasticStrain: source.plasticStrain || 0,
        peakTensileStrain: 0,
        memberMass
      };
    }

    function connectBuildIntersections() {
      const candidates = [];
      const originalMembers = state.members.slice();

      for (let i = 0; i < originalMembers.length; i++) {
        const first = originalMembers[i];
        if (first.broken) continue;
        for (let j = i + 1; j < originalMembers.length; j++) {
          const second = originalMembers[j];
          if (second.broken) continue;
          if (first.a === second.a || first.a === second.b ||
              first.b === second.a || first.b === second.b) continue;

          const hit = memberIntersection(first, second);
          if (hit) candidates.push({ first, second, ...hit });
        }
      }

      if (!candidates.length) return 0;

      const nodeAliases = new Map();
      const splitEvents = new Map();
      const connectedJoints = new Set();
      const endpointSnapDistance = 5;
      const reuseNodeDistance = 4;

      const resolveNode = (node) => {
        let current = node;
        while (nodeAliases.has(current)) current = nodeAliases.get(current);
        return current;
      };

      const aliasNode = (from, to) => {
        const source = resolveNode(from);
        const target = resolveNode(to);
        if (source !== target) nodeAliases.set(source, target);
      };

      const registerMemberJoint = (member, joint) => {
        const a = resolveNode(member.a);
        const b = resolveNode(member.b);
        const span = distance(a, b);
        const t = projectMemberParameter({ a, b }, joint);
        const distanceFromA = t * span;
        const distanceFromB = (1 - t) * span;

        if (distanceFromA <= endpointSnapDistance) {
          aliasNode(a, joint);
          return;
        }
        if (distanceFromB <= endpointSnapDistance) {
          aliasNode(b, joint);
          return;
        }

        if (!splitEvents.has(member)) splitEvents.set(member, []);
        splitEvents.get(member).push({ t, node: joint });
      };

      for (const candidate of candidates) {
        const { first, second, x, y } = candidate;
        const hitPoint = { x, y };
        const nearby = [];

        for (const member of [first, second]) {
          const span = distance(member.a, member.b);
          const t = member === first ? candidate.t : candidate.u;
          if (t * span <= endpointSnapDistance) nearby.push(member.a);
          if ((1 - t) * span <= endpointSnapDistance) nearby.push(member.b);
        }

        for (const node of state.nodes) {
          const resolved = resolveNode(node);
          if (resolved === node && distance(node, hitPoint) <= reuseNodeDistance) nearby.push(node);
        }

        let joint = null;
        if (nearby.length) {
          const unique = [...new Set(nearby.map(resolveNode))];
          unique.sort((a, b) => {
            const pinPriority = Number(!!b.pinned) - Number(!!a.pinned);
            return pinPriority || distance(a, hitPoint) - distance(b, hitPoint);
          });
          joint = unique[0];
          for (let i = 1; i < unique.length; i++) aliasNode(unique[i], joint);
        } else {
          const onFloor = y >= state.ground - 2;
          joint = makeNode(x, onFloor ? state.ground : y, false, onFloor);
          state.nodes.push(joint);
        }

        joint = resolveNode(joint);
        connectedJoints.add(joint);
        registerMemberJoint(first, joint);
        registerMemberJoint(second, joint);
      }

      // Merge nodes that were already at the same intersection, then update every
      // member endpoint so all beams at a junction reference the exact same object.
      for (const member of originalMembers) {
        member.a = resolveNode(member.a);
        member.b = resolveNode(member.b);
        member.points[0] = member.a;
        member.points[member.points.length - 1] = member.b;
      }
      state.nodes = [...new Set(state.nodes.map(resolveNode))];

      const rebuiltMembers = [];
      for (const member of originalMembers) {
        const events = (splitEvents.get(member) || [])
          .map(event => ({ ...event, node: resolveNode(event.node) }))
          .filter(event => event.node !== member.a && event.node !== member.b)
          .sort((a, b) => a.t - b.t);

        if (!events.length || member.broken) {
          rebuiltMembers.push(member);
          continue;
        }

        const uniqueEvents = [];
        for (const event of events) {
          const previous = uniqueEvents[uniqueEvents.length - 1];
          if (previous && (previous.node === event.node || Math.abs(previous.t - event.t) < 1e-4)) {
            if (previous.node !== event.node) aliasNode(event.node, previous.node);
            continue;
          }
          uniqueEvents.push(event);
        }

        const stops = [
          { t: 0, node: member.a },
          ...uniqueEvents.map(event => ({ t: event.t, node: resolveNode(event.node) })),
          { t: 1, node: member.b }
        ];

        let madeFragment = false;
        for (let i = 1; i < stops.length; i++) {
          const start = stops[i - 1], end = stops[i];
          const fragment = createMemberFragment(
            member, resolveNode(start.node), resolveNode(end.node),
            start.t, end.t, !madeFragment
          );
          if (!fragment) continue;
          rebuiltMembers.push(fragment);
          madeFragment = true;
        }
        if (!madeFragment) rebuiltMembers.push(member);
      }

      // Apply any final same-position aliases created while deduplicating events.
      state.members = rebuiltMembers.map(member => {
        member.a = resolveNode(member.a);
        member.b = resolveNode(member.b);
        member.points[0] = member.a;
        member.points[member.points.length - 1] = member.b;
        return member;
      });
      state.nodes = [...new Set(state.nodes.map(resolveNode))];
      recalculateNodeMasses();
      state.firstNode = null;
      state.selectedNode = null;
      state.selectedMember = null;
      state.selectedLoad = null;
      updateInspector();
      return new Set([...connectedJoints].map(resolveNode)).size;
    }

    function resizeCanvas() {
      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const oldW = state.width || rect.width, oldH = state.height || rect.height;
      const sx = rect.width / oldW, sy = rect.height / oldH;
      if (state.width) {
        worldSystems.scaleWorld(sx, sy);
        [...state.nodes, ...state.members.flatMap(m => m.points.slice(1, -1)), ...state.loads].forEach(p => {
          p.x *= sx; p.px *= sx; p.y *= sy; p.py *= sy;
        });
      }
      if (state.testSnapshot) {
        const saved = state.testSnapshot;
        const savedSx = rect.width / Math.max(1, saved.width || oldW);
        const savedSy = rect.height / Math.max(1, saved.height || oldH);
        const savedParticles = [
          ...saved.nodes,
          ...saved.members.flatMap(member => member.interior),
          ...saved.loads
        ];
        savedParticles.forEach(point => {
          point.x *= savedSx; point.px *= savedSx;
          point.y *= savedSy; point.py *= savedSy;
        });
        saved.width = rect.width;
        saved.height = rect.height;
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

    function closestMember(x, y, radius = 12, includeBroken = false) {
      let found = null, best = radius;
      for (const member of state.members) {
        if (member.broken && !includeBroken) continue;
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

    function closestLoad(x, y, radius = 20) {
      let found = null, best = radius;
      for (const load of state.loads) {
        const d = Math.hypot(load.x - x, load.y - y);
        if (d < best) { best = d; found = load; }
      }
      return found;
    }

    function removeMember(member) {
      if (!member) return false;
      state.members = state.members.filter(item => item !== member);
      if (state.selectedMember === member) state.selectedMember = null;
      recalculateNodeMasses();
      return true;
    }

    function removeNode(node) {
      if (!node) return false;
      state.members = state.members.filter(member => member.a !== node && member.b !== node);
      state.nodes = state.nodes.filter(item => item !== node);
      if (state.selectedNode === node) state.selectedNode = null;
      if (state.selectedMember && !state.members.includes(state.selectedMember)) state.selectedMember = null;
      recalculateNodeMasses();
      return true;
    }

    function clearWorld() {
      state.nodes = [];
      state.members = [];
      state.loads = [];
      state.nextNode = 1;
      state.nextMember = 1;
      state.firstNode = null;
      state.selectedNode = null;
      state.selectedMember = null;
      state.selectedLoad = null;
      state.dragging = null;
      state.testSnapshot = null;
      worldSystems.clearAll();
      if (occupantSimulation) occupantSimulation.clear();
      state.firstNavPoint = null;
      state.testMode = false;
      state.paused = true;
      state.accumulator = 0;
      state.lastTime = 0;
      updateSimulationControls();
      updateInspector();
      draw();
    }

    function captureBuildSnapshot() {
      const nodeIndices = new Map(state.nodes.map((node, index) => [node, index]));
      return {
        width: state.width,
        height: state.height,
        nextNode: state.nextNode,
        nextMember: state.nextMember,
        nodes: state.nodes.map(node => ({
          id: node.id, x: node.x, y: node.y, px: node.px, py: node.py,
          pinned: node.pinned, baseNode: !!node.baseNode, radius: node.radius, baseMass: node.baseMass
        })),
        members: state.members.map(member => ({
          id: member.id,
          a: nodeIndices.get(member.a),
          b: nodeIndices.get(member.b),
          material: member.material,
          kind: member.kind || "beam",
          rest: member.rest,
          segmentRest: member.segmentRest,
          segmentRests: (member.segmentRests || []).slice(),
          memberMass: member.memberMass,
          broken: member.broken,
          breakSegment: member.breakSegment,
          stress: member.stress,
          damage: member.damage,
          fatigue: member.fatigue,
          temperature: member.temperature,
          plasticStrain: member.plasticStrain || 0,
          peakTensileStrain: member.peakTensileStrain || 0,
          ignited: !!member.ignited, exploded: !!member.exploded,
          fireTimer: member.fireTimer || 0, smokeTimer: member.smokeTimer || 0,
          detached: !!member.detached, fractureProcessed: !!member.fractureProcessed,
          interior: member.points.slice(1, -1).map(point => ({ ...point }))
        })),
        loads: state.loads.map(load => ({ ...load })),
        navigation: worldSystems.captureNavigation()
      };
    }

    function restoreBuildSnapshot(snapshot) {
      state.nodes = snapshot.nodes.map(node => ({ ...node }));
      state.members = snapshot.members.map(saved => {
        const points = [
          state.nodes[saved.a],
          ...saved.interior.map(point => ({ ...point })),
          state.nodes[saved.b]
        ];
        const { a, b, interior, ...properties } = saved;
        return {
          ...properties,
          a: state.nodes[a],
          b: state.nodes[b],
          points
        };
      });
      state.loads = snapshot.loads.map(load => ({ ...load }));
      worldSystems.clearDynamic();
      worldSystems.restoreNavigation(snapshot.navigation);
      state.nextNode = snapshot.nextNode;
      state.nextMember = snapshot.nextMember;
      state.firstNode = null;
      state.selectedNode = null;
      state.selectedMember = null;
      state.selectedLoad = null;
      state.dragging = null;
      recalculateNodeMasses();
      state.accumulator = 0;
      state.lastTime = 0;
      updateInspector();
      draw();
    }

    function updateSimulationControls() {
      const startButton = document.getElementById("startTestSimulation");
      const resetButton = document.getElementById("resetStructure");
      const clearButton = document.getElementById("clearScene");
      const materialSelect = document.getElementById("materialSelect");
      if (startButton) {
        startButton.textContent = !state.testMode
          ? "▶ Start Test"
          : state.paused ? "▶ Resume Test" : "Ⅱ Pause Test";
        startButton.setAttribute("aria-label", startButton.textContent.trim());
      }
      if (resetButton) resetButton.disabled = !state.testMode || !state.testSnapshot;
      if (clearButton) clearButton.disabled = state.testMode;
      if (materialSelect) materialSelect.disabled = state.testMode;
      document.querySelectorAll("[data-tool]").forEach(button => {
        const buildOnly = ["node", "member", "rope", "load", "delete", "ladder", "stairs", "elevator", "exit"];
        const testOnly = ["break", "explode", "ignite"];
        button.disabled = (state.testMode && buildOnly.includes(button.dataset.tool)) ||
          (!state.testMode && testOnly.includes(button.dataset.tool));
      });
      const spawnButton = document.getElementById("spawnOccupants");
      const clearPopulationButton = document.getElementById("clearOccupants");
      if (spawnButton) spawnButton.disabled = !occupantSimulation || !state.testMode || worldSystems.getExitCount() === 0;
      if (clearPopulationButton) clearPopulationButton.disabled =
        !occupantSimulation || occupantSimulation.getCount() === 0;
    }

    // Rebuild each intact member's hidden simulation stations from its current
    // endpoints before the first physics step. In build mode, users can drag a
    // node after connecting a member; the endpoints move, but the old interior
    // Verlet particles otherwise remain behind. The solver then tries to repair
    // a badly kinked chain in one frame, which can inject enormous energy.
    //
    // Keep the member's stored rest lengths and mass: this removes stale geometry
    // and stale velocity without erasing intentional pre-load/tension.
    function prepareStructureForTest() {
      state.dragging = null;
      state.firstNode = null;

      for (const node of state.nodes) {
        node.px = node.x;
        node.py = node.y;
      }
      for (const load of state.loads) {
        load.px = load.x;
        load.py = load.y;
      }

      for (const member of state.members) {
        if (member.broken || member.detached || !member.a || !member.b) {
          for (const point of member.points || []) {
            point.px = point.x;
            point.py = point.y;
          }
          continue;
        }

        const a = member.a;
        const b = member.b;
        const span = distance(a, b);
        if (!Number.isFinite(span) || span < 0.001) {
          for (const point of member.points || []) {
            point.px = point.x;
            point.py = point.y;
          }
          continue;
        }

        const isRope = member.kind === "rope";
        const sagClearance = Math.max(0, state.ground - Math.max(a.y, b.y) - 4);
        const sag = isRope ? Math.min(span * 0.18, sagClearance) : 0;
        const memberMass = Math.max(0.1, member.memberMass || 0.1);
        const points = [a];

        for (let i = 1; i < 5; i++) {
          const t = i / 5;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t + 4 * t * (1 - t) * sag;
          const pointMass = memberMass / 5;
          points.push({
            x, y, px: x, py: y,
            radius: 2.6,
            mass: pointMass,
            inverseMass: 1 / Math.max(0.05, pointMass),
            material: member.material
          });
        }

        points.push(b);
        member.points = points;
        member.peakTensileStrain = 0;
      }

      recalculateNodeMasses();
    }

    function toggleTestSimulation() {
      if (!state.testMode) {
        if (state.nodes.length < 2 || state.members.length < 1) {
          notify("Build a structure first: add at least two nodes and connect them with a member.");
          return;
        }
        // Snapshot first so Reset Structure restores the exact user-authored build.
        // The automatic joints are generated only for the live test instance.
        state.testSnapshot = captureBuildSnapshot();
        const connectedJoints = connectBuildIntersections();
        prepareStructureForTest();
        state.testMode = true;
        state.paused = false;
        notify(connectedJoints
          ? "Test started. Automatically connected " + connectedJoints + " intersecting joint(s)."
          : "Test started. Reset Structure will restore this exact build.");
      } else {
        state.paused = !state.paused;
      }
      state.accumulator = 0;
      state.lastTime = 0;
      updateSimulationControls();
      draw();
    }

    function resetStructure() {
      if (!state.testMode || !state.testSnapshot) {
        notify("There is no active test to reset. Start a test after building your structure.");
        return;
      }
      const savedBuild = state.testSnapshot;
      restoreBuildSnapshot(savedBuild);
      state.testSnapshot = null;
      state.testMode = false;
      state.paused = true;
      setTool("select");
      updateSimulationControls();
      draw();
      notify("Your original structure has been restored. Build mode is ready.");
    }

    function snappedPoint(point) {
      if (!state.gridSnap) return point;
      const step = state.gridSize;
      return {
        x: Math.round(point.x / step) * step,
        y: Math.round(point.y / step) * step
      };
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
      const debrisCount = document.getElementById("debrisCount");
      const particleCount = document.getElementById("particleCount");
      const connectorCount = document.getElementById("connectorCount");
      const exitCount = document.getElementById("exitCount");
      if (debrisCount) debrisCount.textContent = worldSystems.getDebrisCount();
      if (particleCount) particleCount.textContent = worldSystems.getParticleCount();
      if (connectorCount) connectorCount.textContent = worldSystems.getConnectorCount();
      if (exitCount) exitCount.textContent = worldSystems.getExitCount();
      const count = document.getElementById("structureCount");
      if (count) count.textContent = state.nodes.length + " nodes / " + state.members.length + " members";
      const summary = document.getElementById("selectionSummary");
      if (!summary) return;
      if (state.selectedNode) {
        summary.innerHTML = "<span>●</span><div><b>Node " + state.selectedNode.id + "</b><small>" +
          (state.selectedNode.baseNode ? "Floor base · glued to ground" : state.selectedNode.pinned ? "Pinned support" : "Dynamic node") + "</small></div>";
      } else if (state.selectedMember) {
        summary.innerHTML = "<span>╱</span><div><b>" + state.selectedMember.material + " member</b><small>" +
          (state.selectedMember.broken ? "Failed" : "Stress " + Math.round(state.selectedMember.stress * 100) + "%") + "</small></div>";
      } else if (state.selectedLoad) {
        summary.innerHTML = "<span>↓</span><div><b>Test load</b><small>" + Math.round(state.selectedLoad.mass) + " kg</small></div>";
      } else {
        summary.innerHTML = "<span>＋</span><div><b>Nothing selected</b><small>Select a node or member to inspect it.</small></div>";
      }
    }

    function setTool(tool) {
      state.tool = tool; state.firstNode = null; state.firstNavPoint = null;
      document.querySelectorAll("[data-tool]").forEach(button => {
        const active = button.dataset.tool === tool;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const hints = {
        select: "Select nodes or members. Drag a node to reposition it. Right-click a node to pin it.",
        node: "Click and drag anywhere in the scene to place a node precisely. Release to set it down.",
        member: "Click two existing nodes to connect them with a rigid structural member.",
        rope: "Click two nodes to connect them with a flexible, tension-only rope.",
        load: "Click in the scene to drop a 220 kg test load.",
        heat: "Heat softens members and expands steel. Tension can permanently stretch or snap an overloaded member.",
        delete: "Click a node, member, or test load to remove it. Deleting a node also removes its connected members.",
        break: "Click a member to split it into independent fragments that fall, collide and settle.",
        explode: "Click to apply a radial impulse, damage nearby members and emit dust and sparks.",
        ignite: "Click wood or flammable composite to start fire, heat transfer and smoke.",
        ladder: "Click the first floor landing, then the second landing to add a climbable ladder.",
        stairs: "Click two floor landings to create a traversable stair connection.",
        elevator: "Click two floor stops to create a lift shaft and connected stops.",
        exit: "Click a floor edge to mark a safe exit for evacuation routing."
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
    document.getElementById("spawnOccupants").addEventListener("click", () => {
      if (!occupantSimulation || !state.testMode) {
        notify("Start a structural test before spawning occupants.");
        return;
      }
      if (!worldSystems.getExitCount()) {
        notify("Place at least one exit before spawning occupants.");
        return;
      }
      const added = occupantSimulation.spawn(12, { width: state.width, ground: state.ground });
      notify(added.length + " occupants added. Their Agent Five brains are now active.");
      updateSimulationControls(); updateInspector(); draw();
    });
    document.getElementById("clearOccupants").addEventListener("click", () => {
      if (occupantSimulation) occupantSimulation.clear();
      updateSimulationControls(); updateInspector(); draw();
      notify("Occupant population cleared.");
    });
    document.getElementById("startTestSimulation").addEventListener("click", toggleTestSimulation);
    document.getElementById("resetStructure").addEventListener("click", resetStructure);
    document.getElementById("stressToggle").addEventListener("click", event => {
      state.stress = !state.stress;
      event.currentTarget.textContent = "Stress: " + (state.stress ? "On" : "Off");
      event.currentTarget.setAttribute("aria-pressed", String(state.stress));
      draw();
    });
    document.getElementById("gridSnapToggle").addEventListener("click", event => {
      state.gridSnap = !state.gridSnap;
      event.currentTarget.textContent = "Grid snap: " + (state.gridSnap ? "On" : "Off");
      event.currentTarget.setAttribute("aria-pressed", String(state.gridSnap));
      notify(state.gridSnap ? "Grid snapping enabled (24 px)." : "Grid snapping disabled.");
    });
    document.getElementById("clearScene").addEventListener("click", () => {
      if (state.testMode) {
        notify("Reset Structure before changing or clearing the build.");
        return;
      }
      if (!window.confirm("Clear every node, member, and test load from this scene?")) return;
      clearWorld();
      notify("Scene cleared. The workspace is empty and ready for a new build.");
    });

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function breakMemberAt(x, y) {
      const member = closestMember(x, y, 22);
      if (!member) return null;
      let closestSegment = 0;
      let bestDistance = Infinity;
      for (let i = 1; i < member.points.length; i++) {
        const a = member.points[i - 1], b = member.points[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((x - a.x) * dx + (y - a.y) * dy) /
          Math.max(1, dx * dx + dy * dy), 0, 1);
        const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
        if (d < bestDistance) {
          bestDistance = d;
          closestSegment = i - 1;
        }
      }
      member.broken = true;
      member.breakSegment = closestSegment;
      member.stress = Math.max(member.stress, 1.15);
      worldSystems.fractureMember(member, closestSegment, 1 / 120);
      recalculateNodeMasses();
      state.selectedNode = null;
      state.selectedLoad = null;
      state.selectedMember = member;
      return member;
    }

    canvas.addEventListener("contextmenu", event => {
      event.preventDefault();
      if (state.testMode) {
        notify("Reset Structure to return to build mode before changing supports.");
        return;
      }
      const p = pointerPosition(event), node = closestNode(p.x, p.y);
      if (node) { if (node.baseNode) { notify("Floor base nodes stay glued to the ground."); return; } node.pinned = !node.pinned; refreshNodeInverseMass(node); node.px = node.x; node.py = node.y; updateInspector(); draw(); }
    });
    canvas.addEventListener("pointerdown", event => {
      if (state.testMode && ["node", "member", "rope", "load", "delete", "ladder", "stairs", "elevator", "exit"].includes(state.tool)) {
        notify("The structure is locked during a test. Reset Structure to edit your build.");
        return;
      }
      if (!state.testMode && ["break", "explode", "ignite"].includes(state.tool)) {
        notify("Start the structural test before using destruction or ignition tools.");
        return;
      }
      const rawPoint = pointerPosition(event);
      const p = rawPoint;
      if (event.button === 2) return;
      canvas.setPointerCapture(event.pointerId);
      if (state.tool === "node") {
        const place = snappedPoint(p);
        const isFloorPlacement = place.y >= state.ground - 12;
        const node = makeNode(place.x, isFloorPlacement ? state.ground : place.y, false, isFloorPlacement);
        state.nodes.push(node);
        state.selectedNode = node;
        state.selectedMember = null;
        state.selectedLoad = null;
        state.dragging = node;
        updateInspector();
        draw();
        return;
      }
      if (state.tool === "member" || state.tool === "rope") {
        const node = closestNode(p.x, p.y, 22);
        if (!node) { notify("Connect by clicking two existing nodes."); return; }
        if (!state.firstNode) {
          state.firstNode = node; notify("First node selected. Choose the second node."); draw();
        } else {
          const kind = state.tool === "rope" ? "rope" : "beam";
          const member = addMember(state.firstNode, node, state.material, kind);
          state.firstNode = null;
          if (!member) notify("Those nodes cannot be connected.");
          else notify(kind === "rope" ? "Flexible rope connected." : "Structural member connected.");
          updateInspector(); draw();
        }
        return;
      }
      if (state.tool === "load") {
        const place = snappedPoint(p);
        state.loads.push(makeLoad(place.x, place.y, 220));
        updateInspector(); draw(); return;
      }
      if (state.tool === "ladder" || state.tool === "stairs" || state.tool === "elevator") {
        const place = snappedPoint(p);
        if (!state.firstNavPoint) {
          state.firstNavPoint = { x: place.x, y: place.y };
          notify("First landing marked. Click the connected floor landing.");
        } else {
          const link = worldSystems.addConnector(state.tool, state.firstNavPoint, place);
          state.firstNavPoint = null;
          notify(link
            ? state.tool.charAt(0).toUpperCase() + state.tool.slice(1) + " connection added."
            : "Those two landings are too close or invalid.");
          updateInspector(); draw();
        }
        return;
      }
      if (state.tool === "exit") {
        const exit = worldSystems.addExit(snappedPoint(p));
        notify(exit ? "Safe exit added to the navigation graph." : "Could not place exit here.");
        updateInspector(); draw(); return;
      }
      if (state.tool === "explode") {
        if (!state.testMode) { notify("Start the structural test before applying an explosion."); return; }
        triggerExplosion(p.x, p.y);
        notify("Radial impulse applied. Overloaded members can fracture.");
        updateInspector(); draw(); return;
      }
      if (state.tool === "ignite") {
        if (!state.testMode) { notify("Start the structural test before igniting materials."); return; }
        igniteAt(p.x, p.y);
        updateInspector(); draw(); return;
      }
      if (state.tool === "heat") { applyHeat(p.x, p.y, 20); return; }
      if (state.tool === "delete") {
        const node = closestNode(p.x, p.y);
        const member = node ? null : closestMember(p.x, p.y, 16, true);
        const load = node || member ? null : closestLoad(p.x, p.y, 22);
        state.selectedNode = null;
        state.selectedMember = null;
        state.selectedLoad = null;
        if (node) {
          removeNode(node);
          notify("Node and its connected members deleted.");
        } else if (member) {
          removeMember(member);
          notify("Member deleted.");
        } else if (load) {
          state.loads = state.loads.filter(item => item !== load);
          notify("Test load deleted.");
        } else if (worldSystems.removeNavigationAt(p.x, p.y)) {
          notify("Navigation link or exit deleted.");
        } else {
          notify("Nothing to delete at that location.");
        }
        updateInspector(); draw(); return;
      }
      if (state.tool === "break") {
        const member = breakMemberAt(p.x, p.y);
        if (member) notify("Member fractured. Its two pieces are now free to move.");
        else notify("Select an intact member to break.");
        updateInspector(); draw(); return;
      }
      const node = closestNode(p.x, p.y);
      const member = node ? null : closestMember(p.x, p.y, 12, true);
      const load = node || member ? null : closestLoad(p.x, p.y, 20);
      state.selectedNode = node;
      state.selectedMember = member;
      state.selectedLoad = load;
      if (node && !node.pinned && !state.testMode) state.dragging = node;
      updateInspector(); draw();
    });
    canvas.addEventListener("pointermove", event => {
      const p = pointerPosition(event);
      if (state.dragging) {
        const moveTo = snappedPoint(p);
        state.dragging.x = moveTo.x; state.dragging.y = moveTo.y;
        state.dragging.px = moveTo.x; state.dragging.py = moveTo.y;
        updateInspector();
        draw();
      } else if (state.tool === "heat" && event.buttons === 1) applyHeat(p.x, p.y, 8);
    });
    const endDrag = () => {
      if (state.dragging && !state.dragging.baseNode && state.dragging.y >= state.ground - 12) {
        const node = state.dragging;
        node.y = state.ground; node.py = node.y; node.px = node.x;
        node.baseNode = true; node.pinned = true; refreshNodeInverseMass(node);
        notify("Base node created: glued to the floor.");
        updateInspector(); draw();
      }
      state.dragging = null;
    };
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
        if (nearest < 36) {
          member.temperature = Math.min(1100, member.temperature + amount * (1-nearest/36));
          const profile = materialProfiles[member.material] || {};
          if (profile.flammability > 0 && member.temperature >= (profile.ignitionTemperature || 240)) {
            member.ignited = true;
          }
          if ((profile.explosive || profile.flammability > 0) &&
              member.temperature >= (profile.ignitionTemperature || 270)) {
            member.ignited = true;
            member.fireTimer = 0;
            member.smokeTimer = 0;
          }
        }
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

    function solveTensionConstraint(a, b, rest, stiffness) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthNow = Math.hypot(dx, dy);
      // A rope can go slack: only extension is corrected, never compression.
      if (lengthNow <= rest || lengthNow < 0.001) return;
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
      p.y += vy + GRAVITY_PX_S2 * dt * dt;

      if (p.y > state.ground) {
        p.y = state.ground;
        const materialFriction = profile || materialProfiles.concrete;
        let velocityX = (p.x - p.px) / dt;
        const velocityY = (p.y - p.py) / dt;
        const groundProfile = materialProfiles.concrete;
        const staticFriction = (materialFriction.staticFriction + groundProfile.staticFriction) * 0.5;
        const dynamicFriction = (materialFriction.dynamicFriction + groundProfile.dynamicFriction) * 0.5;
        const stopSpeed = staticFriction * GRAVITY_PX_S2 * dt;
        if (Math.abs(velocityX) <= stopSpeed) velocityX = 0;
        else velocityX -= Math.sign(velocityX) * dynamicFriction * GRAVITY_PX_S2 * dt;
        const restitution = Math.min(0.35, (materialFriction.restitution + groundProfile.restitution) * 0.5);
        const reboundY = velocityY > 0 ? -velocityY * restitution : 0;
        p.px = p.x - velocityX * dt;
        p.py = p.y - reboundY * dt;
      }
    }

    function solveLoadMemberContact(load, member, dt, solveVelocity) {
      if (member.broken || member.detached) return;
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


    function resolveSegmentPairContact(a0, a1, b0, b1) {
      const ux=a1.x-a0.x, uy=a1.y-a0.y, vx=b1.x-b0.x, vy=b1.y-b0.y;
      const wx=a0.x-b0.x, wy=a0.y-b0.y;
      const aa=ux*ux+uy*uy, bb=ux*vx+uy*vy, cc=vx*vx+vy*vy;
      const dd=ux*wx+uy*wy, ee=vx*wx+vy*wy, denom=aa*cc-bb*bb;
      let t=0,u=0;
      if(aa<1e-8&&cc<1e-8)return;
      if(aa<1e-8)u=clamp(ee/Math.max(cc,1e-8),0,1);
      else if(cc<1e-8)t=clamp(-dd/aa,0,1);
      else {t=Math.abs(denom)>1e-8?clamp((bb*ee-cc*dd)/denom,0,1):0;u=clamp((bb*t+ee)/cc,0,1);t=clamp((bb*u-dd)/aa,0,1);}
      const dx=(b0.x+vx*u)-(a0.x+ux*t), dy=(b0.y+vy*u)-(a0.y+uy*t);
      const d=Math.hypot(dx,dy), minimum=Math.max(5.2,((a0.radius||2.6)+(a1.radius||2.6)+(b0.radius||2.6)+(b1.radius||2.6))*0.5);
      if(d>=minimum)return;
      const nx=d>0.001?dx/d:0,ny=d>0.001?dy/d:1;
      const wa0=(a0.inverseMass||0)*(1-t)*(1-t),wa1=(a1.inverseMass||0)*t*t;
      const wb0=(b0.inverseMass||0)*(1-u)*(1-u),wb1=(b1.inverseMass||0)*u*u;
      const sum=wa0+wa1+wb0+wb1;if(sum<=1e-8)return;
      // Keep contact projection out of Verlet velocity and resolve gently.
      // A small positional correction is enough; large repeated pushes destabilize beam networks.
      const push=Math.min(0.35,(minimum-d)*0.12);
      const corrections=[
        [-nx*push*wa0/sum,-ny*push*wa0/sum,a0],
        [-nx*push*wa1/sum,-ny*push*wa1/sum,a1],
        [ nx*push*wb0/sum, ny*push*wb0/sum,b0],
        [ nx*push*wb1/sum, ny*push*wb1/sum,b1]
      ];
      for(const [dxp,dyp,point] of corrections) {
        point.x+=dxp; point.y+=dyp;
        if(Number.isFinite(point.px)) point.px+=dxp;
        if(Number.isFinite(point.py)) point.py+=dyp;
      }
    }

    function solveMemberMemberContacts() {
      for(let i=0;i<state.members.length;i++) {
        const first=state.members[i];
        if (first.broken || first.detached) continue;
        for(let j=i+1;j<state.members.length;j++) {
          const second=state.members[j];
          if (second.broken || second.detached) continue;
          if(first.a===second.a||first.a===second.b||first.b===second.a||first.b===second.b)continue;
          for(let a=1;a<first.points.length;a++)
            for(let b=1;b<second.points.length;b++)
              resolveSegmentPairContact(first.points[a-1],first.points[a],second.points[b-1],second.points[b]);
        }
      }
    }


    function solveLoadLoadContacts() {
      for(let i=0;i<state.loads.length;i++) {
        const a=state.loads[i];
        for(let j=i+1;j<state.loads.length;j++) {
          const b=state.loads[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
          const minimum=(a.radius||0)+(b.radius||0);
          if(d>=minimum)continue;
          const wa=a.inverseMass||0,wb=b.inverseMass||0,sum=wa+wb;
          if(sum<=1e-8)continue;
          const nx=d>0.001?dx/d:1,ny=d>0.001?dy/d:0,push=(minimum-d)*0.82;
          const dax=-nx*push*wa/sum, day=-ny*push*wa/sum;
          const dbx= nx*push*wb/sum, dby= ny*push*wb/sum;
          a.x+=dax; a.y+=day; a.px+=dax; a.py+=day;
          b.x+=dbx; b.y+=dby; b.px+=dbx; b.py+=dby;
        }
      }
    }


    function nearestBreakSegment(member, x, y) {
      let closest = 0, best = Infinity;
      for (let i = 1; i < member.points.length; i++) {
        const a = member.points[i - 1], b = member.points[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
        const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
        if (d < best) { best = d; closest = i - 1; }
      }
      return closest;
    }

    function triggerExplosion(x, y, radius = 150, strength = 950) {
      worldSystems.emitExplosion(x, y, radius, 1);
      const dt = 1 / 120;
      const applyRadialImpulse = point => {
        const dx = point.x - x, dy = point.y - y;
        const d = Math.hypot(dx, dy);
        if (d >= radius || !point.inverseMass) return;
        const falloff = Math.pow(1 - d / radius, 1.35);
        const nx = d > 0.001 ? dx / d : 0;
        const ny = d > 0.001 ? dy / d : -1;
        applyImpulse(point, nx * strength * falloff, ny * strength * falloff, dt);
      };
      for (const node of state.nodes) applyRadialImpulse(node);
      for (const load of state.loads) applyRadialImpulse(load);
      for (const member of state.members) {
        if (member.broken || member.detached) continue;
        let nearest = Infinity, breakSegment = 0;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
          const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
          if (d < nearest) { nearest = d; breakSegment = i - 1; }
        }
        if (nearest >= radius) continue;
        const falloff = Math.pow(1 - nearest / radius, 1.2);
        for (let i = 1; i < member.points.length - 1; i++) applyRadialImpulse(member.points[i]);
        member.damage = clamp(member.damage + falloff * 0.82, 0, 0.99);
        if (falloff > 0.62 || member.damage > 0.88) {
          member.broken = true;
          member.breakSegment = breakSegment;
          worldSystems.fractureMember(member, breakSegment, dt);
        }
      }
      recalculateNodeMasses();
    }

    function igniteAt(x, y) {
      const member = closestMember(x, y, 32);
      if (!member) { notify("Aim at a combustible member to ignite it."); return false; }
      const profile = materialProfiles[member.material] || {};
      if (!(profile.flammability > 0)) {
        notify("This material is not combustible. Try wood or flammable composite.");
        return false;
      }
      member.ignited = true;
      member.temperature = Math.max(member.temperature || 20, profile.ignitionTemperature || 240);
      member.fireTimer = 0;
      member.smokeTimer = 0;
      const center = member.points.reduce((sum, point) => ({
        x: sum.x + point.x / member.points.length,
        y: sum.y + point.y / member.points.length
      }), { x: 0, y: 0 });
      worldSystems.emitFlame(center.x, center.y, 8);
      worldSystems.emitSmoke(center.x, center.y, 6);
      notify(member.material === "explosiveComposite"
        ? "Explosive composite ignited. Keep the simulation running to observe its thermal response."
        : "Member ignited. Fire will transfer heat and produce smoke.");
      return true;
    }

    function iterationGain(targetStiffness, iterations) {
      const target = clamp(targetStiffness, 0, 0.9999);
      return 1 - Math.pow(1 - target, 1 / Math.max(1, iterations));
    }

    function physicsStep(dt) {
      const fireEvents = worldSystems.step(dt, {
        ground: state.ground, width: state.width, members: state.members,
        loads: state.loads, materialProfiles
      });
      for (const event of fireEvents) triggerExplosion(event.x, event.y, 132, 880);
      if (occupantSimulation && state.testMode) {
        occupantSimulation.step(dt, {
          ground: state.ground, width: state.width, members: state.members,
          loads: state.loads, materialProfiles
        });
      }
      for (const node of state.nodes) integrateParticle(node, dt, materialProfiles.concrete);
      for (const member of state.members) {
        if (member.broken || member.detached) continue;
        const profile = materialProfiles[member.material];
        for (let i = 1; i < member.points.length - 1; i++) {
          integrateParticle(member.points[i], dt, profile);
        }
      }
      for (const load of state.loads) integrateParticle(load, dt, materialProfiles.concrete);

      const solverIterations = 14;

      // Test a member's current tensile strain before positional constraints
      // can pull an already-failed member back toward its rest length. Without
      // this pre-solver fracture check, an overloaded member can move an entire
      // connected structure during the 14 projection passes and only then snap.
      for (const member of state.members) {
        member.peakTensileStrain = 0;
        if (member.broken) continue;

        const profile = materialProfiles[member.material];
        const heat = clamp((member.temperature - 20) / 850, 0, 1);
        const strengthFactor = Math.max(0.08, 1 - profile.heatWeakening * heat);
        const remainingIntegrity = Math.max(0.05, 1 - member.damage);
        const tensileCapacity = Math.max(0.012, profile.strain * strengthFactor * remainingIntegrity);
        const thermalScale = 1 + (profile.thermalExpansion || 0) * Math.max(0, member.temperature - 20);
        const effectiveRestScale = thermalScale * (1 + (member.plasticStrain || 0));
        let maximumStrain = 0;
        let maximumStrainSegment = 0;

        for (let i = 1; i < member.points.length; i++) {
          const baseSegmentRest = member.segmentRests?.[i - 1] ?? member.segmentRest;
          const segmentRest = baseSegmentRest * effectiveRestScale;
          const segmentLength = distance(member.points[i - 1], member.points[i]);
          const tensileStrain = Math.max(0, (segmentLength - segmentRest) / Math.max(0.5, segmentRest));
          if (tensileStrain > maximumStrain) {
            maximumStrain = tensileStrain;
            maximumStrainSegment = i - 1;
          }
        }

        member.peakTensileStrain = maximumStrain;
        // Automatic failure releases the member as a whole, matching the
        // existing post-solver fracture path. Do not leave the remaining links
        // actively pulling after one segment has already exceeded capacity.
        if (maximumStrain > tensileCapacity) {
          member.broken = true;
          member.breakSegment = maximumStrainSegment;
          worldSystems.fractureMember(member, maximumStrainSegment, dt);
        }
      }

      for (let iteration = 0; iteration < solverIterations; iteration++) {
        for (const member of state.members) {
          if (member.broken || member.detached) continue;
          const profile = materialProfiles[member.material];
          const heat = clamp((member.temperature - 20) / 850, 0, 1);
          const thermalStiffness = 1 - profile.heatSoftening * heat;
          const thermalScale = 1 + (profile.thermalExpansion || 0) * Math.max(0, member.temperature - 20);
          const effectiveRestScale = thermalScale * (1 + (member.plasticStrain || 0));
          const strengthFactor = Math.max(0.08, 1 - profile.heatWeakening * heat);
          const remainingIntegrity = Math.max(0.05, 1 - member.damage);
          const tensileCapacity = Math.max(0.012, profile.strain * strengthFactor * remainingIntegrity);
          const axialGain = iterationGain(profile.stiffness * thermalStiffness, solverIterations);
          const bendGain = iterationGain(profile.bendStiffness * thermalStiffness, solverIterations);
          let releasedDuringSolve = false;
          for (let i = 1; i < member.points.length; i++) {
            const baseSegmentRest = member.segmentRests?.[i - 1] ?? member.segmentRest;
            const segmentRest = baseSegmentRest * effectiveRestScale;
            const segmentLength = distance(member.points[i - 1], member.points[i]);
            const tensileStrain = Math.max(0, (segmentLength - segmentRest) / Math.max(0.5, segmentRest));
            member.peakTensileStrain = Math.max(member.peakTensileStrain, tensileStrain);

            // Do not project an already-failed member back toward its rest length.
            // That correction would inject a large artificial impulse into the
            // connected structure before the normal end-of-step failure check.
            if (!member.broken && tensileStrain > tensileCapacity) {
              member.broken = true;
              member.breakSegment = i - 1;
              worldSystems.fractureMember(member, i - 1, dt);
              releasedDuringSolve = true;
              break;
            }

            if (member.kind === "rope") {
              solveTensionConstraint(member.points[i - 1], member.points[i], segmentRest, axialGain);
            } else {
              solveConstraint(member.points[i - 1], member.points[i], segmentRest, axialGain);
            }
          }
          if (releasedDuringSolve) continue;
          if (member.kind !== "rope") {
            for (let i = 1; i + 1 < member.points.length; i++) {
              solveConstraint(member.points[i - 1], member.points[i + 1],
                member.segmentRest * 2 * effectiveRestScale, bendGain);
            }
          }
          // Beam rigidity: a structural member must resist distributed curvature,
          // not behave like a chain of freely hinged cloth particles. Project its
          // interior stations toward the endpoint chord with material compliance.
          // Steel yields slightly; wood flexes more; composite stays comparatively rigid.
          if (member.kind !== "rope") {
            const a = member.points[0], b = member.points[member.points.length - 1];
            const beamGain = bendGain;
            for (let i = 1; i < member.points.length - 1; i++) {
              const point = member.points[i];
              const t = i / (member.points.length - 1);
              const targetX = a.x + (b.x - a.x) * t;
              const targetY = a.y + (b.y - a.y) * t;
              const weight = Math.max(0, point.inverseMass || 0);
              if (weight > 0) {
                point.x += (targetX - point.x) * beamGain;
                point.y += (targetY - point.y) * beamGain;
              }
            }
          }
        }
        solveLoadLoadContacts();
        for (const load of state.loads) {
          for (const member of state.members) {
            solveLoadMemberContact(load, member, dt, iteration === solverIterations - 1);
          }
        }
      }

      // Resolve intact-member contacts once after the structural constraints settle.
      // Running this inside every constraint iteration made contact and beam rigidity
      // repeatedly undo one another, injecting large positional corrections.
      solveMemberMemberContacts();

      for (const member of state.members) {
        if (member.broken || member.detached) continue;
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
        const strengthFactor = Math.max(0.08, 1 - profile.heatWeakening * heat);
        const remainingIntegrity = Math.max(0.05, 1 - member.damage);
        const effectiveCapacity = strengthFactor * remainingIntegrity;
        const thermalScale = 1 + (profile.thermalExpansion || 0) * excessTemperature;
        const effectiveRestLength = member.rest * thermalScale * (1 + (member.plasticStrain || 0));
        const bendingCapacity = Math.max(0.08, profile.bend * effectiveCapacity);
        const axialCapacity = Math.max(0.012, profile.strain * effectiveCapacity);
        const finalTensionStrain = Math.max(0, (currentLength - effectiveRestLength) / Math.max(1, effectiveRestLength));
        const tensileStrain = Math.max(member.peakTensileStrain || 0, finalTensionStrain);
        const compressionStrain = member.kind === "rope" ? 0 :
          Math.max(0, (effectiveRestLength - currentLength) / Math.max(1, effectiveRestLength));
        member.stress = Math.max(
          tensileStrain / axialCapacity,
          compressionStrain / axialCapacity,
          member.kind === "rope" ? 0 : maxAngle / bendingCapacity
        );

        const yieldStrain = (profile.tensileYield || profile.strain * 0.5) *
          Math.max(0.15, 1 - profile.heatWeakening * heat);
        if (tensileStrain > yieldStrain) {
          member.plasticStrain = Math.min(0.45, (member.plasticStrain || 0) +
            (tensileStrain - yieldStrain) * (profile.plasticRate || 0.6) *
            (1 + 2 * heat) * dt);
        }
        const fatigueLimit = profile.fatigueSeconds * Math.max(0.25, 1 - 0.65 * heat);
        if (member.stress > 0.62) member.fatigue += dt * (member.stress - 0.58) * 0.75;
        else member.fatigue = Math.max(0, member.fatigue - dt * 0.08);
        member.damage = clamp(member.damage + Math.max(0, member.stress - 0.78) * dt * 0.24, 0, 0.99);
        if (member.stress > 1.0 || member.fatigue > fatigueLimit) {
          member.broken = true;
          member.breakSegment = nearestBreakSegment(member,
            (member.points[0].x + member.points[member.points.length - 1].x) * 0.5,
            (member.points[0].y + member.points[member.points.length - 1].y) * 0.5);
        }
        member.temperature = Math.max(20, member.temperature - dt * 1.5);
      }
      for (const member of state.members) {
        if (member.broken && !member.detached && !member.fractureProcessed) {
          const fallbackSegment = Number.isInteger(member.breakSegment) ? member.breakSegment :
            nearestBreakSegment(member,
              (member.points[0].x + member.points[member.points.length - 1].x) * 0.5,
              (member.points[0].y + member.points[member.points.length - 1].y) * 0.5);
          worldSystems.fractureMember(member, fallbackSegment, dt);
        }
      }
      recalculateNodeMasses();
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
      worldSystems.drawNavigation(ctx);
      for (const member of state.members) {
        if (member.detached) continue;
        const profile=materialProfiles[member.material];
        let color=profile.color;
        if (member.broken) color="#777184";
        else if (state.stress) {
          const s=clamp(member.stress,0,1);
          color=s<.5 ? "rgb("+Math.round(80+45*s*2)+","+Math.round(185+20*s*2)+","+Math.round(205-25*s*2)+")"
            : "rgb("+Math.round(125+125*(s-.5)*2)+","+Math.round(205-145*(s-.5)*2)+","+Math.round(180-130*(s-.5)*2)+")";
        }
        const traceMember = () => {
          if (member.broken && Number.isInteger(member.breakSegment)) {
            const cut = clamp(member.breakSegment, 0, member.points.length - 2);
            const left = member.points[cut], right = member.points[cut + 1];
            const dx = right.x - left.x, dy = right.y - left.y;
            const length = Math.max(0.001, Math.hypot(dx, dy));
            const ux = dx / length, uy = dy / length;
            const gap = 4;
            ctx.beginPath();
            ctx.moveTo(member.points[0].x, member.points[0].y);
            for (let i = 1; i <= cut; i++) ctx.lineTo(member.points[i].x, member.points[i].y);
            ctx.lineTo(left.x - ux * gap, left.y - uy * gap);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(right.x + ux * gap, right.y + uy * gap);
            for (let i = cut + 2; i < member.points.length; i++) {
              ctx.lineTo(member.points[i].x, member.points[i].y);
            }
            ctx.stroke();
          } else {
            ctx.beginPath();ctx.moveTo(member.points[0].x,member.points[0].y);
            for(let i=1;i<member.points.length;i++)ctx.lineTo(member.points[i].x,member.points[i].y);
            ctx.stroke();
          }
        };
        ctx.strokeStyle=color;ctx.lineWidth=member.kind==="rope"?2.8:6;ctx.lineCap="round";ctx.lineJoin="round";
        traceMember();
        if ((member.temperature>80 || member.ignited) && !member.broken) {
          ctx.strokeStyle=member.ignited?"rgba(255,112,57,.42)":"rgba(255,139,78,.28)";
          ctx.lineWidth=member.ignited?15:12;traceMember();
        }
        if (member===state.selectedMember) {
          ctx.strokeStyle="#f0efff";ctx.lineWidth=2;ctx.setLineDash([5,4]);
          traceMember();ctx.setLineDash([]);
        }
      }
      for (const load of state.loads) {
        ctx.fillStyle="#e8ad70";ctx.beginPath();ctx.arc(load.x,load.y,load.radius,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=load===state.selectedLoad?"#ffffff":"#f4d2a9";ctx.lineWidth=load===state.selectedLoad?3:1.5;ctx.stroke();
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
      if (state.firstNavPoint) {
        ctx.strokeStyle="#d2b784";ctx.lineWidth=2;ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.arc(state.firstNavPoint.x,state.firstNavPoint.y,9,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      }
      worldSystems.drawDebrisAndParticles(ctx);
      if (occupantSimulation) occupantSimulation.draw(ctx);
      updateInspector();
      const status=document.querySelector(".view-status span:first-child");
      const modeLabel = !state.testMode
        ? "BUILD MODE / SIMULATION NOT STARTED"
        : state.paused ? "TEST PAUSED / STRUCTURE LOCKED" : "TEST RUNNING / LIVE PHYSICS";
      if(status) status.innerHTML="<i></i> "+modeLabel+" &nbsp; / &nbsp; "+state.nodes.length+
        " NODES &nbsp; / &nbsp; "+worldSystems.getDebrisCount()+" DEBRIS";
    }

    function frame(time) {
      if (!state.lastTime) state.lastTime = time;
      const frameDelta = clamp((time - state.lastTime) / 1000, 0, 0.1);
      state.lastTime = time;
      if (state.testMode && !state.paused && currentScreen === "workspace") {
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
        // Visual particles continue in build mode, but a paused test freezes
        // its particles along with the rest of the simulation.
        if (!state.testMode && currentScreen === "workspace") {
          worldSystems.updateParticles(frameDelta, { width: state.width, ground: state.ground });
        }
      }
      draw();
      requestAnimationFrame(frame);
    }

    canvas.addEventListener("pointermove", event => {
      state.pointer=pointerPosition(event);
    });
    clearWorld();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("keydown", event => {
      if(event.key==="Escape" && currentScreen==="workspace"){showScreen("menu");return;}
      if(event.key==="Escape" && currentScreen==="settings"){showScreen(returnScreen);return;}
      if(currentScreen!=="workspace" || event.ctrlKey || event.metaKey || event.altKey) return;
      const shortcuts={"1":"select","2":"node","3":"member","4":"load","5":"heat","6":"delete","7":"break","8":"explode","9":"ignite",
        "l":"ladder","s":"stairs","e":"elevator","x":"exit"};
      const shortcut=shortcuts[event.key.toLowerCase()];
      if(shortcut) setTool(shortcut);
      if(event.key.toLowerCase()==="t" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) setTool("rope");
      if(event.key.toLowerCase()==="g" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        document.getElementById("gridSnapToggle").click();
      }
      if(event.code==="Space" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        event.preventDefault();
        document.getElementById("startTestSimulation").click();
      }
      if(event.key.toLowerCase()==="r" && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) {
        resetStructure();
      }
    });
    showScreen("menu");
    requestAnimationFrame(frame);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();