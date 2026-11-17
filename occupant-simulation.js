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
  const METERS_PER_PIXEL = Math.sqrt(5) * 0.3048 / 24;
  const OCCUPANT_RADIUS = 5.5;
  const FALL_FATAL_SPEED = 620;
  const IMPACT_FATAL_ENERGY = 2200;
  const CRUSH_FATAL_MASS = 140;
  const MIN_COLLISION_SPEED = 85;

  function createPopulationSimulation(options = {}) {
    const agentApi = options.agentApi || root.FrameLabs3AgentFive;
    const worldSystems = options.worldSystems;
    if (!agentApi || !worldSystems || typeof agentApi.OccupantBrain !== "function") {
      throw new Error("Occupant simulation requires Agent Five and an FL3 world-systems instance.");
    }
    // No jumpable obstacle/collision model exists in the preview yet. A host must
    // explicitly validate a jump opportunity before the neural jump output is used.
    const canJump = typeof options.canJump === "function" ? options.canJump : () => false;

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
          elapsed: 0, distanceTravelled: 0,
          health: 100, injury: 0, lastDamageReason: null,
          recentImpactEnergy: 0, crushExposure: 0, crushLoadKg: 0,
          lastDebrisHits: Object.create(null),
          lastMemberHits: Object.create(null)
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
        connectorId: Number.isInteger(to.id) ? to.id : null,
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

    function findSupportSurface(x, previousY, nextY, world) {
      const ground = finite(world.ground, 0);
      const lower = Math.min(previousY, nextY) - 6;
      const upper = Math.max(previousY, nextY) + 6;
      let best = null;

      const consider = surfaceY => {
        if (!Number.isFinite(surfaceY) || surfaceY < lower || surfaceY > upper) return;
        // Prefer the first surface encountered while falling.
        if (nextY >= previousY && surfaceY < previousY - 6) return;
        if (best === null || Math.abs(surfaceY - previousY) < Math.abs(best - previousY)) {
          best = surfaceY;
        }
      };

      // The ground is always a collision surface.
      if (nextY >= ground || previousY >= ground) consider(ground);

      // Intact, approximately horizontal structural members act as walkable
      // surfaces. Ropes and detached/broken members cannot support occupants.
      for (const member of Array.isArray(world.members) ? world.members : []) {
        if (!member || member.kind === "rope" || member.broken || member.detached ||
            !Array.isArray(member.points) || member.points.length < 2) continue;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) < 0.001 || Math.abs(dy / dx) > 0.35) continue;
          const minX = Math.min(a.x, b.x) - 6, maxX = Math.max(a.x, b.x) + 6;
          if (x < minX || x > maxX) continue;
          const t = clamp((x - a.x) / dx, 0, 1);
          consider(a.y + dy * t);
        }
      }
      return best;
    }

    function applyPhysicalDamage(occupant, damage, reason, stress = {}) {
      if (!occupant || !occupant.brain || occupant.brain.disabled) return false;
      const amount = clamp(finite(damage), 0, 100);
      if (amount > 0) {
        occupant.health = clamp(finite(occupant.health, 100) - amount, 0, 100);
        occupant.injury = 100 - occupant.health;
        occupant.lastDamageReason = reason;
        occupant.lastDamageAt = occupant.elapsed;
        occupant.pendingReward = finite(occupant.pendingReward) - Math.min(2, amount / 45);
        occupant.lastOutcome = reason;
      }
      if (typeof occupant.brain.reportPhysicalStress === "function") {
        occupant.brain.reportPhysicalStress(stress);
      }
      if (occupant.health <= 0 && !occupant.brain.disabled) {
        occupant.brain.disable(reason || "physical-impact");
      }
      if (occupant.brain.disabled) {
        occupant.health = 0;
        occupant.injury = 100;
        occupant.traversal = null;
        occupant.route = null;
      }
      return occupant.brain.disabled;
    }

    function handleLandingImpact(occupant, impactSpeed, fallDistance) {
      const speed = Math.max(0, finite(impactSpeed));
      if (speed < 150 || fallDistance < 10) return;
      const severity = speed / FALL_FATAL_SPEED;
      const damage = clamp(severity * severity * 100, 0, 100);
      applyPhysicalDamage(occupant, damage, "fall-impact", {
        landingImpact: severity
      });
    }

    function nearestPointOnSegment(point, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared > 1e-8
        ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
      return { x: a.x + dx * t, y: a.y + dy * t, t };
    }

    function distanceToRotatedBody(point, body, centerX, centerY, angle) {
      const dx = point.x - centerX, dy = point.y - centerY;
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      const localX = dx * cosine + dy * sine;
      const localY = -dx * sine + dy * cosine;
      const halfLength = Math.max(1, finite(body.length, 8)) * 0.5;
      const halfWidth = Math.max(1, finite(body.width, 5)) * 0.5;
      const outsideX = Math.max(0, Math.abs(localX) - halfLength);
      const outsideY = Math.max(0, Math.abs(localY) - halfWidth);
      return Math.hypot(outsideX, outsideY);
    }

    function registerImpactEnergy(occupant, energyJ, reason, dt) {
      const energy = Math.max(0, finite(energyJ));
      if (energy < 1 || occupant.brain.disabled) return;
      occupant.recentImpactEnergy =
        Math.max(0, finite(occupant.recentImpactEnergy)) * Math.exp(-dt / 0.85) + energy;
      const severity = occupant.recentImpactEnergy / IMPACT_FATAL_ENERGY;
      const damage = clamp(energy / IMPACT_FATAL_ENERGY * 85, 0, 85);
      applyPhysicalDamage(occupant, damage, reason, { impactForce: severity });
    }

    function updateDebrisImpacts(occupant, dt) {
      const debris = typeof worldSystems.getDebris === "function"
        ? worldSystems.getDebris() : [];
      const center = { x: occupant.x, y: occupant.y - OCCUPANT_RADIUS };
      const safeDt = Math.max(1 / 240, dt);
      let staticCrushMass = 0;
      const activeDebrisContacts = new Set();

      for (let index = 0; index < debris.length; index++) {
        const body = debris[index];
        if (!body || !Number.isFinite(body.x + body.y)) continue;
        const px = finite(body.px, body.x), py = finite(body.py, body.y);
        const angle = finite(body.angle);
        const previousAngle = finite(body.previousAngle, angle);
        const currentDistance = distanceToRotatedBody(center, body, body.x, body.y, angle);
        const previousDistance = distanceToRotatedBody(center, body, px, py, previousAngle);
        const sweepPoint = nearestPointOnSegment(center, { x: px, y: py }, { x: body.x, y: body.y });
        const sweepDistance = distance(center, sweepPoint);
        const sweepRadius = OCCUPANT_RADIUS + Math.min(18, Math.max(0, finite(body.radius)));
        const currentContact = currentDistance <= OCCUPANT_RADIUS;
        const previousContact = previousDistance <= OCCUPANT_RADIUS;
        const sweptContact = sweepDistance <= sweepRadius;
        if (!currentContact && !previousContact && !sweptContact) continue;

        const key = String(body.id === undefined ? index : body.id);
        activeDebrisContacts.add(key);
        const vx = (body.x - px) / safeDt;
        const vy = (body.y - py) / safeDt;
        const relativeSpeed = Math.hypot(vx - finite(occupant.vx), vy - finite(occupant.vy));
        const bodyMass = clamp(finite(body.mass, 1), 0.05, 100000);

        if (relativeSpeed >= MIN_COLLISION_SPEED &&
            finite(occupant.lastDebrisHits[key], -Infinity) + 0.42 <= occupant.elapsed) {
          occupant.lastDebrisHits[key] = occupant.elapsed;
          const speedMps = relativeSpeed * METERS_PER_PIXEL;
          registerImpactEnergy(
            occupant, 0.5 * bodyMass * speedMps * speedMps,
            "falling-debris-impact", safeDt
          );
          if (occupant.brain.disabled) return;
        }

        if (currentContact && (body.settled || relativeSpeed < 45)) {
          staticCrushMass += bodyMass;
        }
      }

      for (const key of Object.keys(occupant.lastDebrisHits)) {
        if (!activeDebrisContacts.has(key) &&
            occupant.elapsed - occupant.lastDebrisHits[key] > 2) {
          delete occupant.lastDebrisHits[key];
        }
      }

      occupant.crushLoadKg = staticCrushMass;
      if (staticCrushMass > 0) {
        occupant.crushExposure = finite(occupant.crushExposure) +
          dt * clamp(staticCrushMass / 50, 0, 3);
        const severity = Math.max(staticCrushMass / CRUSH_FATAL_MASS, occupant.crushExposure / 3);
        const crushDamage = dt * 18 * clamp(staticCrushMass / 70, 0, 2);
        applyPhysicalDamage(occupant, crushDamage, "trapped-under-rubble", {
          crushForce: severity
        });
      } else {
        occupant.crushExposure = Math.max(0, finite(occupant.crushExposure) - dt * 0.7);
      }
    }

    function updateMovingMemberImpacts(occupant, dt, world) {
      const members = Array.isArray(world.members) ? world.members : [];
      const center = { x: occupant.x, y: occupant.y - OCCUPANT_RADIUS };
      const safeDt = Math.max(1 / 240, dt);

      for (const member of members) {
        if (!member || member.broken || member.detached || member.kind === "rope" ||
            !Array.isArray(member.points) || member.points.length < 2) continue;
        let totalLength = 0;
        for (let i = 1; i < member.points.length; i++) {
          totalLength += distance(member.points[i - 1], member.points[i]);
        }
        if (totalLength < 1) continue;

        let strongestEnergy = 0;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i];
          const previousA = { x: finite(a.px, a.x), y: finite(a.py, a.y) };
          const previousB = { x: finite(b.px, b.x), y: finite(b.py, b.y) };
          const currentHit = nearestPointOnSegment(center, a, b);
          const previousHit = nearestPointOnSegment(center, previousA, previousB);
          const currentDistance = distance(center, currentHit);
          const previousDistance = distance(center, previousHit);
          const trajectoryA = nearestPointOnSegment(center, previousA, a);
          const trajectoryB = nearestPointOnSegment(center, previousB, b);
          const trajectoryDistance = Math.min(distance(center, trajectoryA), distance(center, trajectoryB));
          const thickness = member.kind === "slab" ? 10 : 6;
          if (Math.min(currentDistance, previousDistance, trajectoryDistance) >
              OCCUPANT_RADIUS + thickness) continue;

          const t = currentDistance <= previousDistance ? currentHit.t : previousHit.t;
          const avx = (a.x - previousA.x) / safeDt;
          const avy = (a.y - previousA.y) / safeDt;
          const bvx = (b.x - previousB.x) / safeDt;
          const bvy = (b.y - previousB.y) / safeDt;
          const vx = avx * (1 - t) + bvx * t;
          const vy = avy * (1 - t) + bvy * t;
          const relativeSpeed = Math.hypot(vx - finite(occupant.vx), vy - finite(occupant.vy));
          if (relativeSpeed < MIN_COLLISION_SPEED) continue;

          const segmentMass = Math.max(0.05,
            finite(member.memberMass, 1) * distance(a, b) / totalLength);
          const speedMps = relativeSpeed * METERS_PER_PIXEL;
          strongestEnergy = Math.max(strongestEnergy, 0.5 * segmentMass * speedMps * speedMps);
        }

        const key = String(member.id);
        if (strongestEnergy > 0 &&
            finite(occupant.lastMemberHits[key], -Infinity) + 0.42 <= occupant.elapsed) {
          occupant.lastMemberHits[key] = occupant.elapsed;
          registerImpactEnergy(occupant, strongestEnergy, "moving-structure-impact", safeDt);
          if (occupant.brain.disabled) return;
        }
      }

      for (const key of Object.keys(occupant.lastMemberHits)) {
        if (occupant.elapsed - occupant.lastMemberHits[key] > 2) delete occupant.lastMemberHits[key];
      }
    }

    function updatePhysicalHazards(occupant, dt, world) {
      occupant.recentImpactEnergy =
        Math.max(0, finite(occupant.recentImpactEnergy)) * Math.exp(-dt / 0.85);
      updateDebrisImpacts(occupant, dt);
      if (occupant.brain.disabled) return;
      updateMovingMemberImpacts(occupant, dt, world);
    }

    function updateVerticalPhysics(occupant, dt, world) {
      if (occupant.traversal) return;
      occupant.jumpCooldown = Math.max(0, occupant.jumpCooldown - dt);

      const jumpOpportunity = canJump(occupant, world) === true;
      if (jumpOpportunity && occupant.grounded &&
          agentApi.shouldJump(occupant.controls, true, occupant.jumpCooldown <= 0)) {
        occupant.vy = -JUMP_SPEED;
        occupant.grounded = false;
        occupant.jumpCooldown = 0.95;
      }

      const previousY = occupant.y;
      if (!occupant.grounded) occupant.vy += GRAVITY * dt;
      else occupant.vy = Math.max(0, occupant.vy);

      const nextY = previousY + occupant.vy * dt;
      const supportY = findSupportSurface(occupant.x, previousY, nextY, world);
      if (supportY !== null && nextY >= previousY - 0.001) {
        if (!occupant.grounded) {
          handleLandingImpact(occupant, occupant.vy, Math.max(0, supportY - previousY));
        }
        occupant.y = supportY;
        occupant.floorY = supportY;
        occupant.vy = 0;
        occupant.grounded = true;
      } else if (supportY !== null && occupant.grounded && nextY <= previousY) {
        occupant.y = supportY;
      } else {
        occupant.y = nextY;
        occupant.grounded = false;
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
        if (occupant.evacuated) continue;
        occupant.elapsed += safeDt;
        if (occupant.brain.disabled) {
          occupant.vx = 0;
          occupant.traversal = null;
          updateVerticalPhysics(occupant, safeDt, world);
          continue;
        }
        updatePhysicalHazards(occupant, safeDt, world);
        if (occupant.brain.disabled) {
          occupant.vx = 0;
          occupant.traversal = null;
          continue;
        }
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

        if (occupant.traversal) {
          const traversal = occupant.traversal;
          if (traversal.connectorId !== null) {
            const liveConnector = worldSystems.getConnectors().find(
              item => item.id === traversal.connectorId
            );
            if (!liveConnector || liveConnector.falling) {
              occupant.traversal = null;
              occupant.route = null;
              occupant.routeTimer = 0;
              occupant.grounded = false;
              occupant.vy = Math.max(0, occupant.vy);
              updateVerticalPhysics(occupant, safeDt, world);
              continue;
            }
          }
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
          updateVerticalPhysics(occupant, safeDt, world);
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
        const injuryMobility = 0.45 + clamp(finite(occupant.health, 100) / 100, 0, 1) * 0.55;
        const speed = 48 * (0.72 + drive * 0.28) * (1 - brake * 0.48) * injuryMobility;
        const oldX = occupant.x;
        occupant.vx = steering * speed;
        occupant.x = clamp(occupant.x + occupant.vx * safeDt, 12, width - 12);
        occupant.distanceTravelled += Math.abs(occupant.x - oldX);
        occupant.floorY = first.y;
        updateVerticalPhysics(occupant, safeDt, world);

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
          occupant.health < 35 ? "#df777e" :
          occupant.health < 70 ? "#e0a36d" :
          occupant.brain.panic > 0.7 ? "#e0a36d" : "#b8c5ff";
        ctx.strokeStyle = "rgba(15,16,30,.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (occupant.evacuated || occupant.health < 99.9) {
          ctx.strokeStyle = occupant.evacuated ? "#79d2a4" :
            occupant.health < 35 ? "#df777e" : "#e0a36d";
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
      getInjuredCount: () => occupants.filter(item => item.health < 99.9).length,
      getOccupants: () => occupants
    });
  }

  const api = Object.freeze({ version: 1, createPopulationSimulation, maxOccupants: MAX_OCCUPANTS });
  root.FrameLabs3OccupantSimulation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
