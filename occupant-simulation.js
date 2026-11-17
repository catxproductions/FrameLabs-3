/*
 * FrameLabs 3 occupant population runtime.
 *
 * This module deliberately sits between the structural world and Agent Five:
 * the world owns hazards/navigation, the neural brain selects controls, and
 * this adapter owns lightweight occupant movement and rendering.
 */
(function (root) {
  "use strict";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) =>
    Number.isFinite(Number(value)) ? Number(value) : fallback;
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const DECISION_INTERVAL = 0.16;
  const MAX_OCCUPANTS = 150;
  const GRAVITY = 460;
  const JUMP_SPEED = 145;

  function createPopulationSimulation(options = {}) {
    const agentApi = options.agentApi || root.FrameLabs3AgentFive;
    const worldSystems = options.worldSystems;
    if (!agentApi || !worldSystems || typeof agentApi.OccupantBrain !== "function") {
      throw new Error("Occupant simulation requires Agent Five and an FL3 world-systems instance.");
    }

    const occupants = [];
    let nextId = 1;

    function getWorldFloors(ground) {
      const levels = typeof worldSystems.floorLevels === "function"
        ? worldSystems.floorLevels(ground) : [ground];
      return (Array.isArray(levels) && levels.length ? levels : [ground])
        .filter(Number.isFinite)
        .sort((a, b) => b - a);
    }

    function spawn(count = 12, world = {}) {
      const amount = clamp(Math.floor(finite(count, 12)), 1, MAX_OCCUPANTS);
      const width = Math.max(80, finite(world.width, 800));
      const ground = finite(world.ground, 0);
      const floors = getWorldFloors(ground);
      const spawned = [];
      const initialCount = occupants.length;
      const totalAfterSpawn = Math.min(MAX_OCCUPANTS, initialCount + amount);

      for (let i = 0; i < amount && occupants.length < MAX_OCCUPANTS; i++) {
        const slot = initialCount + i;
        const floorY = floors[slot % floors.length];
        const x = clamp(width * ((slot + 1) / (totalAfterSpawn + 1)), 24, width - 24);
        const id = "occupant-" + nextId++;
        const occupant = {
          id,
          brain: new agentApi.OccupantBrain({ id }),
          x, y: floorY, floorY, vx: 0, vy: 0,
          controls: { thrustLeft: 0, thrustRight: 0, brake: 0, jump: 0 },
          decisionTimer: 0, routeTimer: 0, route: null,
          hasAction: false, pendingReward: 0, lastOutcome: "navigation",
          jumpCooldown: 0, grounded: true, evacuated: false,
          elapsed: 0, distanceTravelled: 0
        };
        occupants.push(occupant);
        spawned.push(occupant);
      }
      return spawned;
    }

    function clear() {
      occupants.length = 0;
      nextId = 1;
    }

    function nearestMemberHazard(x, y, members) {
      let temperature = 20;
      let structuralDanger = 0;
      for (const member of Array.isArray(members) ? members : []) {
        if (!member || !Array.isArray(member.points) || !member.points.length) continue;
        let cx = 0, cy = 0;
        for (const point of member.points) { cx += point.x; cy += point.y; }
        cx /= member.points.length;
        cy /= member.points.length;
        const d = Math.hypot(cx - x, cy - y);
        if (d > 150) continue;
        const proximity = 1 - d / 150;
        temperature = Math.max(temperature, finite(member.temperature, 20) * proximity);
        const stress = clamp(finite(member.stress) / 1.4, 0, 1);
        const broken = member.broken || member.detached ? 0.45 : 0;
        structuralDanger = Math.max(structuralDanger, Math.max(stress, broken) * proximity);
      }
      return { temperature, structuralDanger: clamp(structuralDanger, 0, 1) };
    }

    function nearbyOccupantDensity(subject) {
      let nearby = 0;
      for (const other of occupants) {
        if (other === subject || other.evacuated) continue;
        if (distance(subject, other) < 90) nearby++;
      }
      return clamp(nearby / 5, 0, 1);
    }

    function buildPerception(occupant, world) {
      const width = Math.max(80, finite(world.width, 800));
      const ground = finite(world.ground, 0);
      const hazards = nearestMemberHazard(occupant.x, occupant.y, world.members);
      const debrisClearance = worldSystems.debrisClearanceAt(occupant.x, occupant.y);
      return worldSystems.occupantPerception(occupant.x, occupant.y, {
        distanceFromWall: Math.min(occupant.x, width - occupant.x),
        temperature: hazards.temperature,
        fallingSpeed: Math.max(0, occupant.vy),
        distanceFromFallingObject: Number.isFinite(debrisClearance) ? debrisClearance : width,
        horizontalSpeed: occupant.vx,
        structuralDanger: hazards.structuralDanger,
        nearbyOccupantDensity: nearbyOccupantDensity(occupant)
      }, {
        ground,
        members: Array.isArray(world.members) ? world.members : []
      });
    }

    function beginConnectorTraversal(occupant, from, to, kind) {
      occupant.traversal = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        kind,
        waitRemaining: kind === "elevator" ? 0.55 : 0
      };
    }

    function moveToward(occupant, target, speed, dt) {
      const dx = target.x - occupant.x;
      const dy = target.y - occupant.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.001) return true;
      const travel = Math.min(d, speed * dt);
      occupant.x += dx / d * travel;
      occupant.y += dy / d * travel;
      return d <= speed * dt + 0.001;
    }

    function updateJump(occupant, dt, world) {
      occupant.jumpCooldown = Math.max(0, occupant.jumpCooldown - dt);
      const jumpOpportunity = canJump(occupant, world) === true;
      if (jumpOpportunity && occupant.grounded &&
          agentApi.shouldJump(occupant.controls, true, occupant.jumpCooldown <= 0)) {
        occupant.vy = -JUMP_SPEED;
        occupant.grounded = false;
        occupant.jumpCooldown = 0.95;
      }
      if (!occupant.grounded && !occupant.traversal) {
        occupant.y += occupant.vy * dt;
        occupant.vy += GRAVITY * dt;
        if (occupant.y >= occupant.floorY) {
          occupant.y = occupant.floorY;
          occupant.vy = 0;
          occupant.grounded = true;
        }
      }
    }

    function updateRoute(occupant, world) {
      occupant.route = worldSystems.findRouteToExit(
        occupant.x, occupant.y, finite(world.ground, 0)
      );
      occupant.routeTimer = 0.22;
    }

    function step(dt, world = {}) {
      const safeDt = clamp(finite(dt), 0, 0.05);
      if (safeDt <= 0 || !occupants.length) return;
      const width = Math.max(80, finite(world.width, 800));
      const members = Array.isArray(world.members) ? world.members : [];

      for (const occupant of occupants) {
        if (occupant.evacuated || occupant.brain.disabled) continue;
        occupant.elapsed += safeDt;
        occupant.decisionTimer -= safeDt;
        occupant.routeTimer -= safeDt;

        if (occupant.routeTimer <= 0 || !occupant.route) updateRoute(occupant, world);
        const route = occupant.route;

        if (occupant.decisionTimer <= 0) {
          const perception = buildPerception(occupant, world);
          if (occupant.hasAction) {
            occupant.brain.recordOutcome(
              occupant.pendingReward,
              occupant.lastOutcome || "navigation"
            );
          }
          const decision = occupant.brain.decide(perception, DECISION_INTERVAL);
          occupant.controls = decision.controls || {
            thrustLeft: 0, thrustRight: 0, brake: 1, jump: 0
          };
          occupant.hasAction = !decision.disabled;
          occupant.pendingReward = 0;
          occupant.decisionTimer = DECISION_INTERVAL;
          if (decision.disabled) continue;
        }

        updateJump(occupant, safeDt, world);

        if (occupant.traversal) {
          const traversal = occupant.traversal;
          if (traversal.waitRemaining > 0) {
            traversal.waitRemaining = Math.max(0, traversal.waitRemaining - safeDt);
            occupant.vx = 0;
            continue;
          }
          const speed = traversal.kind === "ladder" ? 38 :
            traversal.kind === "elevator" ? 64 : 52;
          if (moveToward(occupant, traversal.to, speed, safeDt)) {
            occupant.floorY = traversal.to.y;
            occupant.y = traversal.to.y;
            occupant.traversal = null;
            occupant.route = null;
            occupant.routeTimer = 0;
            occupant.grounded = true;
            occupant.vy = 0;
          }
          continue;
        }

        if (!route || !Array.isArray(route.path) || !route.path.length) {
          occupant.vx = 0;
          occupant.pendingReward -= safeDt * 0.025;
          occupant.lastOutcome = "no-route";
          continue;
        }

        if (distance(occupant, route.exit) <= 13) {
          occupant.evacuated = true;
          occupant.vx = 0;
          if (occupant.hasAction) {
            occupant.brain.recordOutcome(2, "safe-exit", { terminal: true });
            occupant.hasAction = false;
          }
          continue;
        }

        const path = route.path;
        const first = path[0];
        let target = first;
        if (distance(occupant, first) <= 17 && path.length > 1) {
          const next = path[1];
          if (next.connectorKind && next.connectorKind !== "walk") {
            beginConnectorTraversal(occupant, first, next, next.connectorKind);
            continue;
          }
          target = next;
        }

        const desiredDirection = Math.sign(target.x - occupant.x);
        const aiSteering = finite(occupant.controls.thrustRight) -
          finite(occupant.controls.thrustLeft);
        // Route following is the stability prior; the neural policy supplies
        // meaningful steering variation and speed modulation around that route.
        const steering = clamp(desiredDirection * 0.82 + aiSteering * 0.18, -1, 1);
        const drive = Math.max(
          finite(occupant.controls.thrustLeft),
          finite(occupant.controls.thrustRight)
        );
        const brake = clamp(finite(occupant.controls.brake), 0, 1);
        const speed = 48 * (0.72 + drive * 0.28) * (1 - brake * 0.48);
        const oldX = occupant.x;
        occupant.vx = steering * speed;
        occupant.x = clamp(occupant.x + occupant.vx * safeDt, 12, width - 12);
        occupant.distanceTravelled += Math.abs(occupant.x - oldX);
        occupant.floorY = first.y;
        const remainingRoute = worldSystems.findRouteToExit(
          occupant.x, occupant.y, finite(world.ground, 0)
        );
        const before = Number.isFinite(route.distance) ? route.distance : 0;
        const after = remainingRoute && Number.isFinite(remainingRoute.distance)
          ? remainingRoute.distance : before;
        occupant.pendingReward += clamp((before - after) / 1000, -0.03, 0.03);
        occupant.pendingReward -= safeDt *
          (perceptionHazard(occupant, worldSystems, members) * 0.012 + 0.002);
        occupant.lastOutcome = "navigation";
      }
    }

    function perceptionHazard(occupant, systems, members) {
      return clamp(
        systems.smokeDensityAt(occupant.x, occupant.y) * 0.6 +
        systems.fireIntensityAt(occupant.x, occupant.y, members) * 0.4,
        0, 1
      );
    }

    function draw(ctx) {
      if (!ctx) return;
      for (const occupant of occupants) {
        const hop = !occupant.grounded
          ? Math.max(0, Math.min(1, -occupant.vy / (JUMP_SPEED * 1.2))) * 5 : 0;
        const x = occupant.x, y = occupant.y - 5 - hop;
        ctx.save();
        ctx.globalAlpha = occupant.evacuated ? 0.62 : 0.95;
        ctx.fillStyle = occupant.evacuated ? "#79d2a4" :
          occupant.brain.disabled ? "#777184" :
          occupant.brain.panic > 0.7 ? "#e0a36d" : "#b8c5ff";
        ctx.strokeStyle = "rgba(15,16,30,.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (occupant.evacuated) {
          ctx.strokeStyle = "#79d2a4";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 8.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    return Object.freeze({
      spawn, clear, step, draw,
      getCount: () => occupants.length,
      getEvacuatedCount: () => occupants.filter(item => item.evacuated).length,
      getDisabledCount: () => occupants.filter(item => item.brain.disabled).length,
      getOccupants: () => occupants
    });
  }

  const api = Object.freeze({ version: 1, createPopulationSimulation, maxOccupants: MAX_OCCUPANTS });
  root.FrameLabs3OccupantSimulation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
