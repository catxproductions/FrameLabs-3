/*
 * FrameLabs 3 simulation systems.
 * Independent structural debris, emitted atmosphere particles, fire propagation,
 * and multi-floor navigation primitives. Rendering and structural-force thresholds
 * remain owned by the FL3 host simulation.
 */
(function (root) {
  "use strict";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const MAX_DEBRIS = 180;
  const MAX_PARTICLES = 720;
  const GRAVITY = 1800;

  function createWorldSystems() {
    const debris = [];
    const particles = [];
    const connectors = [];
    const exits = [];
    let nextDebrisId = 1;
    let nextConnectorId = 1;
    let nextExitId = 1;
    let emittedParticleCount = 0;
    let fractureCount = 0;

    function addParticle(kind, x, y, vx, vy, radius, life, material) {
      const values = [x, y, vx, vy, radius, life];
      if (!values.every(Number.isFinite) || radius <= 0 || life <= 0) return false;
      if (particles.length >= MAX_PARTICLES) {
        let weakest = 0;
        for (let i = 1; i < particles.length; i++) {
          const score = particles[i].life / Math.max(0.01, particles[i].maxLife);
          const current = particles[weakest].life / Math.max(0.01, particles[weakest].maxLife);
          if (score < current) weakest = i;
        }
        particles.splice(weakest, 1);
      }
      particles.push({
        kind, x, y, vx, vy, radius, life, maxLife: life,
        age: 0, material: material || "steel",
        seed: Math.random() * Math.PI * 2
      });
      emittedParticleCount++;
      return true;
    }

    function emitDust(x, y, amount = 18, material = "concrete", strength = 1) {
      const count = clamp(Math.floor(finite(amount)), 0, 120);
      const intensity = clamp(finite(strength, 1), 0.2, 4);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (18 + Math.random() * 115) * intensity;
        addParticle("dust", x + (Math.random() - 0.5) * 9, y + (Math.random() - 0.5) * 9,
          Math.cos(angle) * speed, -Math.abs(Math.sin(angle) * speed) - 12,
          2 + Math.random() * 4, 1.8 + Math.random() * 3.8, material);
      }
    }

    function emitSparks(x, y, amount = 7, strength = 1) {
      const count = clamp(Math.floor(finite(amount)), 0, 80);
      const intensity = clamp(finite(strength, 1), 0.2, 4);
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * (0.15 + Math.random() * 0.7);
        const speed = (70 + Math.random() * 260) * intensity;
        addParticle("spark", x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
          1 + Math.random() * 1.5, 0.28 + Math.random() * 0.52, "steel");
      }
    }

    function emitSmoke(x, y, amount = 3, density = 1) {
      const count = clamp(Math.floor(finite(amount)), 0, 80);
      const opacity = clamp(finite(density, 1), 0.05, 3);
      for (let i = 0; i < count; i++) {
        addParticle("smoke", x + (Math.random() - 0.5) * 12, y,
          (Math.random() - 0.5) * 32, -22 - Math.random() * 48,
          6 + Math.random() * 7, (4.5 + Math.random() * 4) * opacity, "smoke");
      }
    }

    function emitFlame(x, y, amount = 2) {
      const count = clamp(Math.floor(finite(amount)), 0, 80);
      for (let i = 0; i < count; i++) {
        addParticle("flame", x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 26, -30 - Math.random() * 65,
          3 + Math.random() * 5, 0.24 + Math.random() * 0.42, "fire");
      }
    }

    function pathVelocity(point, dt) {
      const safeDt = Math.max(1 / 240, finite(dt, 1 / 120));
      return {
        x: (finite(point.x) - finite(point.px, point.x)) / safeDt,
        y: (finite(point.y) - finite(point.py, point.y)) / safeDt
      };
    }

    function makeDebrisBody(member, path, dt, side) {
      if (!Array.isArray(path) || path.length < 2) return null;
      const first = path[0], last = path[path.length - 1];
      const dx = last.x - first.x, dy = last.y - first.y;
      const chord = Math.hypot(dx, dy);
      const arcLength = path.slice(1).reduce((sum, point, index) =>
        sum + distance(path[index], point), 0);
      const length = Math.max(8, arcLength, chord);
      const center = {
        x: path.reduce((sum, point) => sum + point.x, 0) / path.length,
        y: path.reduce((sum, point) => sum + point.y, 0) / path.length
      };
      const velocities = path.map(point => pathVelocity(point, dt));
      const vx = velocities.reduce((sum, velocity) => sum + velocity.x, 0) / velocities.length;
      const vy = velocities.reduce((sum, velocity) => sum + velocity.y, 0) / velocities.length;
      const angle = chord > 0.001 ? Math.atan2(dy, dx) : 0;
      let angularVelocity = 0;
      if (chord > 0.001) {
        const firstV = velocities[0], lastV = velocities[velocities.length - 1];
        angularVelocity = clamp((dx * (lastV.y - firstV.y) - dy * (lastV.x - firstV.x)) /
          Math.max(36, chord * chord), -8, 8);
      }
      const materialDensity = member.material === "steel" ? 7.8 :
        member.material === "concrete" ? 2.35 : member.material === "wood" ? 0.68 : 1.25;
      const originalLength = Math.max(1, member.rest || arcLength || chord);
      const mass = Math.max(0.08, finite(member.memberMass, length * materialDensity * 0.002) *
        clamp(length / originalLength, 0.08, 1));
      return {
        id: nextDebrisId++,
        x: center.x, y: center.y, px: center.x - vx * Math.max(1 / 240, dt),
        py: center.y - vy * Math.max(1 / 240, dt),
        angle, previousAngle: angle - angularVelocity * Math.max(1 / 240, dt),
        length: clamp(length, 8, 420),
        width: member.kind === "rope" ? 2.2 : member.material === "concrete" ? 8 : 5.5,
        mass, radius: clamp(length * 0.17, 4.5, 24),
        material: member.material || "steel",
        restitution: member.material === "steel" ? 0.14 : 0.08,
        friction: member.material === "concrete" ? 0.82 : 0.66,
        settled: false, age: 0, side
      };
    }

    function fractureMember(member, breakSegment, dt = 1 / 120) {
      if (!member || member.fractureProcessed) return false;
      const points = Array.isArray(member.points) ? member.points : [];
      if (points.length < 3) return false;
      const segment = clamp(Math.floor(finite(breakSegment)), 0, points.length - 2);
      const leftPath = points.slice(0, segment + 1);
      const rightPath = points.slice(segment + 1);
      // Include the fracture gap's two faces as separate endpoints so the
      // fragments inherit the member's motion without remaining constrained.
      if (leftPath.length < 2) leftPath.push({ ...points[segment], x: points[segment].x - 2 });
      if (rightPath.length < 2) rightPath.unshift({ ...points[segment + 1], x: points[segment + 1].x + 2 });

      const leftBody = makeDebrisBody(member, leftPath, dt, "left");
      const rightBody = makeDebrisBody(member, rightPath, dt, "right");
      if (leftBody) debris.push(leftBody);
      if (rightBody) debris.push(rightBody);
      if (debris.length > MAX_DEBRIS) debris.splice(0, debris.length - MAX_DEBRIS);

      const faceA = points[segment], faceB = points[segment + 1];
      const x = (faceA.x + faceB.x) * 0.5, y = (faceA.y + faceB.y) * 0.5;
      const heat = clamp((finite(member.temperature, 20) - 20) / 500, 0, 1);
      emitDust(x, y, member.material === "concrete" ? 25 : 17, member.material, 0.7 + heat);
      if (member.material === "steel" || heat > 0.45) emitSparks(x, y, 5 + Math.floor(heat * 8), 0.75 + heat);
      if (member.material === "wood" || member.material === "flammableComposite") {
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 100;
          addParticle("splinter", x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 25,
            2 + Math.random() * 2, 1.2 + Math.random() * 1.5, member.material);
        }
      }
      member.broken = true;
      member.breakSegment = segment;
      member.detached = true;
      member.fractureProcessed = true;
      fractureCount++;
      return true;
    }

    function emitExplosion(x, y, radius = 120, intensity = 1) {
      emitDust(x, y, 38, "concrete", 1.3 * intensity);
      emitSparks(x, y, 22, intensity);
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (35 + Math.random() * 100) * intensity;
        addParticle("smoke", x + Math.cos(angle) * 8, y + Math.sin(angle) * 8,
          Math.cos(angle) * speed * 0.35, Math.sin(angle) * speed * 0.35 - 35,
          8 + Math.random() * 7, 4 + Math.random() * 4, "smoke");
      }
      return { x, y, radius, intensity };
    }

    function nearestPointOnSegment(point, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared > 1e-8
        ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
      return { x: a.x + dx * t, y: a.y + dy * t, t };
    }

    function updateFire(dt, world) {
      const members = Array.isArray(world.members) ? world.members : [];
      const profiles = world.materialProfiles || {};
      const burning = members.filter(member => member && Array.isArray(member.points) &&
        member.points.length > 0 && member.ignited && !member.broken && !member.detached);
      for (const member of burning) {
        const profile = profiles[member.material] || {};
        member.temperature = Math.min(1100, finite(member.temperature, 20) + dt * (profile.burnRate || 95));
        member.fireTimer = finite(member.fireTimer) - dt;
        member.smokeTimer = finite(member.smokeTimer) - dt;
        const center = member.points.reduce((sum, point) => ({
          x: sum.x + point.x / member.points.length,
          y: sum.y + point.y / member.points.length
        }), { x: 0, y: 0 });
        if (member.fireTimer <= 0) {
          emitFlame(center.x, center.y, member.material === "wood" ? 3 : 2);
          member.fireTimer = 0.07 + Math.random() * 0.08;
        }
        if (member.smokeTimer <= 0) {
          emitSmoke(center.x, center.y - 3, member.material === "wood" ? 4 : 2, 1);
          member.smokeTimer = 0.18 + Math.random() * 0.18;
        }

        // Heat transfers to nearby members, not merely to decorative particles.
        for (const target of members) {
          if (target === member || !Array.isArray(target.points) || target.points.length < 2 ||
              target.broken || target.detached) continue;
          let nearest = Infinity;
          for (let i = 1; i < target.points.length; i++) {
            nearest = Math.min(nearest, distance(nearestPointOnSegment(center,
              target.points[i - 1], target.points[i]), center));
          }
          if (nearest > 24) continue;
          const targetProfile = profiles[target.material] || {};
          const transfer = (1 - nearest / 24) * dt * 42;
          target.temperature = Math.min(1100, finite(target.temperature, 20) + transfer);
          const ignitionTemperature = finite(targetProfile.ignitionTemperature, 260);
          if (finite(targetProfile.flammability) > 0 && target.temperature >= ignitionTemperature) {
            target.ignited = true;
          }
        }

        if (profile.explosive && member.temperature >= finite(profile.ignitionTemperature, 360) &&
            !member.exploded) {
          member.exploded = true;
          member.explosionRequested = true;
        }
      }
    }

    function updateDebris(dt, world) {
      const ground = finite(world.ground, 0);
      const width = Math.max(1, finite(world.width, 100000));
      const members = Array.isArray(world.members) ? world.members : [];
      const loads = Array.isArray(world.loads) ? world.loads : [];
      const wind = finite(world.wind, 0);
      for (const body of debris) {
        body.age += dt;
        if (body.settled) continue;
        const damping = Math.pow(0.997, dt * 120);
        let vx = (body.x - body.px) * damping;
        let vy = (body.y - body.py) * damping + GRAVITY * dt * dt;
        vx += wind * dt * dt * 7;
        const angularVelocity = clamp((body.angle - body.previousAngle) * damping, -0.25, 0.25);
        body.px = body.x; body.py = body.y; body.previousAngle = body.angle;
        body.x += vx; body.y += vy;
        body.angle += angularVelocity;

        const verticalExtent = Math.abs(Math.sin(body.angle)) * body.length * 0.5 + body.width * 0.5;
        const bottom = body.y + verticalExtent;
        if (bottom > ground) {
          body.y -= bottom - ground;
          const impactVelocity = (body.y - body.py) / Math.max(dt, 1e-5);
          const horizontalVelocity = (body.x - body.px) / Math.max(dt, 1e-5);
          const rebound = impactVelocity > 32 ? -impactVelocity * body.restitution : 0;
          body.py = body.y - rebound * dt;
          body.px = body.x - horizontalVelocity * (1 - body.friction * 0.55) * dt;
          body.previousAngle = body.angle - angularVelocity * (1 - body.friction * 0.7);
          if (Math.abs(rebound) < 22 && Math.abs(horizontalVelocity) < 18 && Math.abs(angularVelocity) < 0.018) {
            body.settled = true;
            body.py = body.y; body.px = body.x; body.previousAngle = body.angle;
          }
        }
        const sideExtent = Math.abs(Math.cos(body.angle)) * body.length * 0.5 + body.width;
        if (body.x < sideExtent) { body.x = sideExtent; body.px = body.x; }
        if (body.x > width - sideExtent) { body.x = width - sideExtent; body.px = body.x; }

        // Debris bounces off still-standing members. This is intentionally a
        // bounded, one-way contact approximation; structural nodes retain their
        // own solver constraints and cannot be dragged around by visual particles.
        const radius = body.radius;
        for (const member of members) {
          if (!member || !Array.isArray(member.points) || member.points.length < 2 ||
              member.broken || member.detached) continue;
          for (let i = 1; i < member.points.length; i++) {
            const hit = nearestPointOnSegment(body, member.points[i - 1], member.points[i]);
            let dx = body.x - hit.x, dy = body.y - hit.y;
            const d = Math.hypot(dx, dy), minimum = radius + 3.2;
            if (d >= minimum) continue;
            if (d < 0.001) { dx = 0; dy = -1; }
            else { dx /= d; dy /= d; }
            body.x += dx * (minimum - d);
            body.y += dy * (minimum - d);
            const currentVx = (body.x - body.px) / Math.max(dt, 1e-5);
            const currentVy = (body.y - body.py) / Math.max(dt, 1e-5);
            const normalSpeed = currentVx * dx + currentVy * dy;
            if (normalSpeed < 0) {
              const bounce = normalSpeed * (1 + body.restitution);
              body.px = body.x - (currentVx - bounce * dx * 0.8) * dt;
              body.py = body.y - (currentVy - bounce * dy * 0.8) * dt;
            }
          }
        }
        for (const load of loads) {
          const dx = body.x - load.x, dy = body.y - load.y;
          const d = Math.hypot(dx, dy), minimum = radius + finite(load.radius, 9);
          if (d >= minimum) continue;
          const nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : -1;
          body.x += nx * (minimum - d); body.y += ny * (minimum - d);
          body.px = body.x - vx * 0.35; body.py = body.y - vy * 0.35;
        }
      }

      // Pair contacts are done after integration so each pair is resolved once.
      for (let i = 0; i < debris.length; i++) {
        const a = debris[i];
        for (let j = i + 1; j < debris.length; j++) {
          const b = debris[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy), minimum = a.radius + b.radius;
          if (d >= minimum) continue;
          const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
          const totalMass = Math.max(0.1, a.mass + b.mass);
          const overlap = (minimum - d) * 0.52;
          a.x -= nx * overlap * b.mass / totalMass;
          a.y -= ny * overlap * b.mass / totalMass;
          b.x += nx * overlap * a.mass / totalMass;
          b.y += ny * overlap * a.mass / totalMass;
          a.px = a.x - (a.x - a.px) * 0.76;
          a.py = a.y - (a.y - a.py) * 0.76;
          b.px = b.x - (b.x - b.px) * 0.76;
          b.py = b.y - (b.y - b.py) * 0.76;
          a.settled = false; b.settled = false;
        }
      }
    }

    function updateParticles(dt, world = {}) {
      const safeDt = clamp(finite(dt), 0, 0.05);
      const wind = finite(world.wind, 0);
      for (const particle of particles) {
        if (![particle.x, particle.y, particle.vx, particle.vy, particle.radius, particle.life].every(Number.isFinite)) {
          particle.life = 0;
          continue;
        }
        particle.age += safeDt;
        particle.life -= safeDt;
        const isSmoke = particle.kind === "smoke";
        const isDust = particle.kind === "dust";
        const isFlame = particle.kind === "flame";
        if (isSmoke) {
          particle.vx += (wind * 8 + (Math.random() - 0.5) * 14) * safeDt;
          particle.vy -= 12 * safeDt;
          particle.radius += 3.5 * safeDt;
        } else if (isDust) {
          particle.vx += wind * 3 * safeDt;
          particle.vy -= 8 * safeDt;
          particle.radius += 1.4 * safeDt;
        } else {
          particle.vy += GRAVITY * 0.32 * safeDt;
          particle.vx *= Math.pow(0.985, safeDt * 60);
          if (isFlame) particle.radius *= Math.max(0.1, 1 - safeDt * 1.9);
        }
        particle.x += particle.vx * safeDt;
        particle.y += particle.vy * safeDt;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].life <= 0 || particles[i].radius < 0.35) particles.splice(i, 1);
      }
    }

    function step(dt, world = {}) {
      const safeDt = clamp(finite(dt), 0, 0.05);
      updateFire(safeDt, world);
      updateDebris(safeDt, world);
      updateParticles(safeDt, world);
      const requested = [];
      for (const member of (Array.isArray(world.members) ? world.members : [])) {
        if (member && member.explosionRequested) {
          member.explosionRequested = false;
          if (!Array.isArray(member.points) || !member.points.length) continue;
          const center = member.points.reduce((sum, point) => ({
            x: sum.x + point.x / member.points.length,
            y: sum.y + point.y / member.points.length
          }), { x: 0, y: 0 });
          requested.push({ member, ...center });
        }
      }
      return requested;
    }

    function smokeDensityAt(x, y, radius = 140) {
      let density = 0;
      for (const particle of particles) {
        if (particle.kind !== "smoke") continue;
        const d = Math.hypot(particle.x - x, particle.y - y);
        if (d < radius + particle.radius) {
          density += (1 - d / (radius + particle.radius)) * clamp(particle.life / particle.maxLife, 0, 1) * 0.09;
        }
      }
      return clamp(density, 0, 1);
    }

    function fireIntensityAt(x, y, members) {
      let intensity = 0;
      for (const member of Array.isArray(members) ? members : []) {
        if (!member || !Array.isArray(member.points) || !member.points.length ||
            !member.ignited || member.broken || member.detached) continue;
        const center = member.points.reduce((sum, p) => ({
          x: sum.x + p.x / member.points.length, y: sum.y + p.y / member.points.length
        }), { x: 0, y: 0 });
        const d = distance({ x, y }, center);
        intensity = Math.max(intensity, clamp(1 - d / 130, 0, 1));
      }
      return intensity;
    }

    function debrisClearanceAt(x, y) {
      let nearest = Infinity;
      for (const body of debris) {
        if (body.settled && body.age > 25) continue;
        nearest = Math.min(nearest, Math.max(0, Math.hypot(body.x - x, body.y - y) - body.radius));
      }
      return nearest;
    }

    function normalizeConnectorAnchor(anchor) {
      if (!anchor || typeof anchor !== "object") return null;
      if (anchor.type === "node" && Number.isInteger(anchor.id)) {
        return { type: "node", id: anchor.id };
      }
      if (anchor.type === "member" && Number.isInteger(anchor.id) &&
          Number.isInteger(anchor.segmentIndex) && Number.isFinite(anchor.t)) {
        return {
          type: "member", id: anchor.id, segmentIndex: Math.max(0, anchor.segmentIndex),
          t: clamp(anchor.t, 0, 1)
        };
      }
      return null;
    }

    function resolveConnectorAnchor(anchor, fallback, world) {
      if (!anchor) return null;
      const nodes = Array.isArray(world.nodes) ? world.nodes : [];
      const members = Array.isArray(world.members) ? world.members : [];
      if (anchor.type === "node") {
        const node = nodes.find(item => item && item.id === anchor.id);
        if (node) return { point: { x: node.x, y: node.y }, anchor };
      }
      if (anchor.type === "member") {
        const member = members.find(item => item && item.id === anchor.id);
        if (member) {
          if (member.broken || member.detached || member.kind === "rope" ||
              !Array.isArray(member.points) || member.points.length < 2) return null;
          const index = clamp(anchor.segmentIndex, 0, member.points.length - 2);
          const a = member.points[index], b = member.points[index + 1];
          const t = clamp(anchor.t, 0, 1);
          return {
            point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
            anchor: { type: "member", id: member.id, segmentIndex: index, t }
          };
        }
      }

      // Auto-connect can merge coincident nodes or split intersecting members
      // when a test starts. Rebind a stale saved anchor to nearby live geometry.
      if (!fallback) return null;
      let nearestNode = null, nearestNodeDistance = 18;
      for (const node of nodes) {
        if (!node || !Number.isFinite(node.x + node.y)) continue;
        const d = distance(fallback, node);
        if (d < nearestNodeDistance) { nearestNode = node; nearestNodeDistance = d; }
      }
      if (nearestNode) {
        return {
          point: { x: nearestNode.x, y: nearestNode.y },
          anchor: { type: "node", id: nearestNode.id }
        };
      }

      let nearest = null, nearestDistance = 14;
      for (const member of members) {
        if (!member || member.broken || member.detached || member.kind === "rope" ||
            !Array.isArray(member.points) || member.points.length < 2) continue;
        for (let i = 1; i < member.points.length; i++) {
          const hit = nearestPointOnSegment(fallback, member.points[i - 1], member.points[i]);
          const d = distance(fallback, hit);
          if (d < nearestDistance) {
            nearestDistance = d;
            nearest = {
              point: { x: hit.x, y: hit.y },
              anchor: { type: "member", id: member.id, segmentIndex: i - 1, t: hit.t }
            };
          }
        }
      }
      return nearest;
    }

    function startConnectorFall(link, dt, resolvedA, resolvedB) {
      if (resolvedA) link.a = { ...resolvedA.point };
      if (resolvedB) link.b = { ...resolvedB.point };
      const safeDt = Math.max(1 / 240, finite(dt, 1 / 120));
      const previousA = link.previousA || link.a;
      const previousB = link.previousB || link.b;
      const oldAngle = Math.atan2(previousB.y - previousA.y, previousB.x - previousA.x);
      const newAngle = Math.atan2(link.b.y - link.a.y, link.b.x - link.a.x);
      let angleDelta = newAngle - oldAngle;
      while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      link.centerX = (link.a.x + link.b.x) * 0.5;
      link.centerY = (link.a.y + link.b.y) * 0.5;
      link.length = Math.max(1, distance(link.a, link.b));
      link.angle = newAngle;
      link.vx = ((link.a.x - previousA.x) + (link.b.x - previousB.x)) * 0.5 / safeDt;
      link.vy = ((link.a.y - previousA.y) + (link.b.y - previousB.y)) * 0.5 / safeDt;
      link.angularVelocity = clamp(angleDelta / safeDt, -5, 5);
      link.falling = true;
    }

    function connectorSupportY(link, previousBottom, nextBottom, world) {
      const ground = finite(world.ground, 0);
      let best = null;
      const consider = surfaceY => {
        if (!Number.isFinite(surfaceY) || surfaceY < previousBottom - 3 || surfaceY > nextBottom + 3) return;
        if (best === null || surfaceY < best) best = surfaceY;
      };
      if (previousBottom >= ground - 3 || nextBottom >= ground) consider(ground);

      for (const member of Array.isArray(world.members) ? world.members : []) {
        if (!member || member.broken || member.detached || member.kind === "rope" ||
            !Array.isArray(member.points) || member.points.length < 2) continue;
        for (let i = 1; i < member.points.length; i++) {
          const a = member.points[i - 1], b = member.points[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          if (Math.abs(dx) < 0.001 || Math.abs(dy / dx) > 0.35) continue;
          const minX = Math.min(a.x, b.x) - link.length * 0.5;
          const maxX = Math.max(a.x, b.x) + link.length * 0.5;
          if (link.centerX < minX || link.centerX > maxX) continue;
          const t = clamp((link.centerX - a.x) / dx, 0, 1);
          consider(a.y + dy * t);
        }
      }
      return best;
    }

    function updateFallingConnector(link, dt, world) {
      const safeDt = clamp(finite(dt), 0, 0.05);
      if (safeDt <= 0) return;
      const previousCenterY = link.centerY;
      const damping = Math.pow(0.997, safeDt * 60);
      link.vx *= damping;
      link.vy += GRAVITY * safeDt;
      link.angularVelocity *= Math.pow(0.994, safeDt * 60);
      link.centerX += link.vx * safeDt;
      link.centerY += link.vy * safeDt;
      link.angle += link.angularVelocity * safeDt;

      const extentY = Math.abs(Math.sin(link.angle)) * link.length * 0.5 +
        Math.abs(Math.cos(link.angle)) * link.width * 0.5;
      const supportY = connectorSupportY(
        link, previousCenterY + extentY, link.centerY + extentY, world
      );
      if (supportY !== null) {
        const impactSpeed = link.vy;
        link.centerY = supportY - extentY;
        link.vy = impactSpeed > 55 ? -impactSpeed * 0.065 : 0;
        link.vx *= 0.72;
        link.angularVelocity *= 0.38;
        if (Math.abs(link.vy) < 10) link.vy = 0;
        if (Math.abs(link.angularVelocity) < 0.035) link.angularVelocity = 0;
      }

      const width = Math.max(1, finite(world.width, 100000));
      const extentX = Math.abs(Math.cos(link.angle)) * link.length * 0.5 +
        Math.abs(Math.sin(link.angle)) * link.width * 0.5;
      if (link.centerX < extentX) {
        link.centerX = extentX;
        link.vx = Math.abs(link.vx) * 0.12;
      } else if (link.centerX > width - extentX) {
        link.centerX = width - extentX;
        link.vx = -Math.abs(link.vx) * 0.12;
      }

      const halfX = Math.cos(link.angle) * link.length * 0.5;
      const halfY = Math.sin(link.angle) * link.length * 0.5;
      link.a = { x: link.centerX - halfX, y: link.centerY - halfY };
      link.b = { x: link.centerX + halfX, y: link.centerY + halfY };
      link.previousA = { ...link.a };
      link.previousB = { ...link.b };
    }

    function addConnector(kind, a, b, attachments) {
      if (!["ladder", "stairs", "elevator"].includes(kind)) return null;
      if (!a || !b || !Number.isFinite(a.x + a.y + b.x + b.y) || distance(a, b) < 28) return null;
      const physicsEnabled = !!(attachments && typeof attachments === "object");
      const connector = {
        id: nextConnectorId++, kind,
        a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y },
        previousA: { x: a.x, y: a.y }, previousB: { x: b.x, y: b.y },
        anchors: physicsEnabled ? {
          a: normalizeConnectorAnchor(attachments.a),
          b: normalizeConnectorAnchor(attachments.b)
        } : null,
        physicsEnabled, falling: false,
        restLength: distance(a, b), length: distance(a, b),
        width: kind === "elevator" ? 28 : kind === "stairs" ? 9 : 3,
        centerX: (a.x + b.x) * 0.5, centerY: (a.y + b.y) * 0.5,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        vx: 0, vy: 0, angularVelocity: 0
      };
      connectors.push(connector);
      return connector;
    }

    function updateConnectors(dt, world = {}) {
      const safeDt = clamp(finite(dt), 0, 0.05);
      if (safeDt <= 0) return;
      for (const link of connectors) {
        if (!link.physicsEnabled) continue;
        if (link.falling) {
          updateFallingConnector(link, safeDt, world);
          continue;
        }

        const resolvedA = resolveConnectorAnchor(link.anchors?.a, link.a, world);
        const resolvedB = resolveConnectorAnchor(link.anchors?.b, link.b, world);
        if (resolvedA && resolvedB) {
          const span = distance(resolvedA.point, resolvedB.point);
          if (span >= link.restLength * 0.78 && span <= link.restLength * 1.22) {
            const previousA = link.a, previousB = link.b;
            link.previousA = { ...previousA };
            link.previousB = { ...previousB };
            link.a = { ...resolvedA.point };
            link.b = { ...resolvedB.point };
            link.anchors.a = resolvedA.anchor;
            link.anchors.b = resolvedB.anchor;
            link.centerX = (link.a.x + link.b.x) * 0.5;
            link.centerY = (link.a.y + link.b.y) * 0.5;
            link.length = span;
            link.angle = Math.atan2(link.b.y - link.a.y, link.b.x - link.a.x);
            continue;
          }
        }

        // A lost attachment or excessive relative floor movement releases the
        // complete stair/shaft assembly as a falling rigid connector.
        startConnectorFall(link, safeDt, resolvedA, resolvedB);
        updateFallingConnector(link, safeDt, world);
      }
    }

    function addExit(point) {
      if (!point || !Number.isFinite(point.x + point.y)) return null;
      const existing = exits.find(exit => distance(exit, point) < 24);
      if (existing) return existing;
      const exit = { id: nextExitId++, x: point.x, y: point.y };
      exits.push(exit);
      return exit;
    }

    function removeNavigationAt(x, y, radius = 26) {
      let best = null, bestDistance = radius;
      for (const connector of connectors) {
        const midpoint = { x: (connector.a.x + connector.b.x) * 0.5, y: (connector.a.y + connector.b.y) * 0.5 };
        const d = distance(midpoint, { x, y });
        if (d < bestDistance) { best = { type: "connector", item: connector }; bestDistance = d; }
      }
      for (const exit of exits) {
        const d = distance(exit, { x, y });
        if (d < bestDistance) { best = { type: "exit", item: exit }; bestDistance = d; }
      }
      if (!best) return false;
      if (best.type === "connector") connectors.splice(connectors.indexOf(best.item), 1);
      else exits.splice(exits.indexOf(best.item), 1);
      return true;
    }

    function floorLevels(ground = 0) {
      const values = [finite(ground)];
      for (const link of connectors) {
        if (!link.falling) values.push(link.a.y, link.b.y);
      }
      for (const exit of exits) values.push(exit.y);
      const unique = [];
      for (const value of values.sort((a, b) => b - a)) {
        if (!unique.some(existing => Math.abs(existing - value) < 16)) unique.push(value);
      }
      return unique;
    }

    function floorIndexAt(y, ground = 0) {
      const levels = floorLevels(ground);
      let best = 0, error = Infinity;
      for (let i = 0; i < levels.length; i++) {
        const d = Math.abs(levels[i] - y);
        if (d < error) { best = i; error = d; }
      }
      return best + 1;
    }

    function findRouteToExit(x, y, ground = 0) {
      if (!exits.length || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      const nodes = [];
      const connectorNodeIndices = new Map();
      const exitNodeIndices = new Map();
      const addNode = (point, type, id) => {
        nodes.push({ x: point.x, y: point.y, type, id, edges: [] });
        return nodes.length - 1;
      };
      for (const link of connectors) {
        if (link.falling) continue;
        connectorNodeIndices.set(link.id, {
          a: addNode(link.a, "connector", link.id),
          b: addNode(link.b, "connector", link.id)
        });
      }
      for (const exit of exits) exitNodeIndices.set(exit.id, addNode(exit, "exit", exit.id));

      const connect = (a, b, cost, connectorKind = "walk") => {
        nodes[a].edges.push({ to: b, cost, connectorKind });
        nodes[b].edges.push({ to: a, cost, connectorKind });
      };
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (floorIndexAt(nodes[i].y, ground) === floorIndexAt(nodes[j].y, ground)) {
            connect(i, j, distance(nodes[i], nodes[j]), "walk");
          }
        }
      }
      for (const link of connectors) {
        if (link.falling) continue;
        const indices = connectorNodeIndices.get(link.id);
        const d = distance(nodes[indices.a], nodes[indices.b]);
        const multiplier = link.kind === "ladder" ? 1.85 : link.kind === "stairs" ? 1.28 : 0.82;
        const waitPenalty = link.kind === "elevator" ? 90 : 0;
        connect(indices.a, indices.b, d * multiplier + waitPenalty, link.kind);
      }

      const distances = Array(nodes.length).fill(Infinity);
      const previous = Array(nodes.length).fill(null);
      const visited = Array(nodes.length).fill(false);
      const startFloor = floorIndexAt(y, ground);
      for (let i = 0; i < nodes.length; i++) {
        if (floorIndexAt(nodes[i].y, ground) === startFloor) distances[i] = distance({ x, y }, nodes[i]);
      }
      if (!distances.some(Number.isFinite)) return null;

      // Dijkstra's algorithm. Navigation graphs are intentionally compact, so a
      // simple array-based priority selection avoids an additional dependency.
      for (let iteration = 0; iteration < nodes.length; iteration++) {
        let current = -1, best = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          if (!visited[i] && distances[i] < best) { best = distances[i]; current = i; }
        }
        if (current < 0) break;
        visited[current] = true;
        for (const edge of nodes[current].edges) {
          if (visited[edge.to]) continue;
          const candidate = distances[current] + edge.cost;
          if (candidate < distances[edge.to]) {
            distances[edge.to] = candidate;
            previous[edge.to] = { from: current, connectorKind: edge.connectorKind };
          }
        }
      }

      let bestExit = null, bestCost = Infinity, bestExitIndex = -1;
      for (const exit of exits) {
        const index = exitNodeIndices.get(exit.id);
        const cost = distances[index];
        if (cost < bestCost) { bestCost = cost; bestExit = exit; bestExitIndex = index; }
      }
      if (!bestExit || !Number.isFinite(bestCost)) return null;

      const path = [];
      let cursor = bestExitIndex;
      const visitedPath = new Set();
      while (cursor !== null && cursor >= 0 && !visitedPath.has(cursor)) {
        visitedPath.add(cursor);
        path.unshift({
          x: nodes[cursor].x, y: nodes[cursor].y, type: nodes[cursor].type,
          id: nodes[cursor].id, connectorKind: previous[cursor]?.connectorKind || "walk"
        });
        cursor = previous[cursor] ? previous[cursor].from : null;
      }
      return {
        exit: { x: bestExit.x, y: bestExit.y, id: bestExit.id },
        distance: bestCost,
        floor: floorIndexAt(bestExit.y, ground),
        currentFloor: startFloor,
        floorDifference: floorIndexAt(bestExit.y, ground) - startFloor,
        direction: Math.sign(bestExit.x - x),
        path
      };
    }

    function occupantPerception(x, y, extras = {}, world = {}) {
      const ground = finite(world.ground, 0);
      const route = findRouteToExit(x, y, ground);
      const maxDistance = finite(extras.maxDistance, 400);
      const maxFloors = finite(extras.maxFloors, 10);
      const nearestFloor = floorLevels(ground).reduce((best, level) =>
        Math.abs(level - y) < Math.abs(best - y) ? level : best, ground);
      return {
        distanceFromFloor: Math.abs(y - nearestFloor),
        currentFloor: floorIndexAt(y, ground),
        distanceFromWall: finite(extras.distanceFromWall, maxDistance),
        temperature: finite(extras.temperature, 20),
        fallingSpeed: finite(extras.fallingSpeed, 0),
        distanceFromFallingObject: finite(extras.distanceFromFallingObject, debrisClearanceAt(x, y)),
        panic: clamp(finite(extras.panic, 0), 0, 1),
        horizontalSpeed: finite(extras.horizontalSpeed, 0),
        distanceFromExit: route ? route.distance : maxDistance * 3,
        exitDirection: route ? route.direction : 0,
        floorDifferenceToExit: route ? route.floorDifference : 0,
        smokeDensity: smokeDensityAt(x, y),
        fireIntensity: fireIntensityAt(x, y, world.members),
        structuralDanger: clamp(finite(extras.structuralDanger, 0), 0, 1),
        nearbyOccupantDensity: clamp(finite(extras.nearbyOccupantDensity, 0), 0, 1),
        debrisClearance: debrisClearanceAt(x, y) === Infinity ? maxDistance : debrisClearanceAt(x, y),
        scale: { maxFloorDistance: maxDistance, maxFloor: maxFloors, maxWallDistance: maxDistance,
          maxFallingSpeed: 20, maxHorizontalSpeed: 12, maxExitDistance: maxDistance * 3,
          maxFloorDifference: maxFloors, maxFallingObjectDistance: maxDistance,
          maxDebrisClearance: maxDistance, ambientTemperature: 20, maxTemperature: 1000 }
      };
    }

    function drawNavigation(ctx) {
      ctx.save();
      for (const link of connectors) {
        const { a, b, kind } = link;
        ctx.lineCap = "round";
        if (kind === "ladder") {
          ctx.strokeStyle = "#d2b784"; ctx.lineWidth = 3;
          const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
          const nx = -dy / length * 8, ny = dx / length * 8;
          ctx.beginPath(); ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
          ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(b.x - nx, b.y - ny); ctx.stroke();
          const steps = Math.max(2, Math.floor(length / 13));
          for (let i = 1; i < steps; i++) {
            const t = i / steps, x = a.x + dx * t, y = a.y + dy * t;
            ctx.beginPath(); ctx.moveTo(x + nx, y + ny); ctx.lineTo(x - nx, y - ny); ctx.stroke();
          }
        } else if (kind === "stairs") {
          ctx.strokeStyle = "#a9a6dd"; ctx.lineWidth = 3;
          const steps = Math.max(3, Math.floor(distance(a, b) / 14));
          ctx.beginPath(); ctx.moveTo(a.x, a.y);
          for (let i = 1; i <= steps; i++) {
            const t = i / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
            const tread = (b.x >= a.x ? 1 : -1) * 9;
            ctx.lineTo(x - tread, y); ctx.lineTo(x - tread, y - 7);
          }
          ctx.lineTo(b.x, b.y); ctx.stroke();
        } else {
          // Draw the shaft in its local orientation so a collapsed elevator
          // visibly rotates with the same rigid-body transform as its physics.
          const dx = b.x - a.x, dy = b.y - a.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / length * 13, ny = dx / length * 13;
          const angle = Math.atan2(dy, dx);
          const centerX = (a.x + b.x) * 0.5;
          const centerY = (a.y + b.y) * 0.5;
          ctx.strokeStyle = "#82c3c5"; ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
          ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(b.x - nx, b.y - ny);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(84,166,174,.24)";
          ctx.strokeStyle = "#82c3c5";
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(angle);
          ctx.fillRect(-10, -10, 20, 20);
          ctx.strokeRect(-10, -10, 20, 20);
          ctx.restore();
          ctx.beginPath();
          ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(a.x + nx, a.y + ny);
          ctx.moveTo(b.x - nx, b.y - ny); ctx.lineTo(b.x + nx, b.y + ny);
          ctx.stroke();
        }
        ctx.fillStyle = "#d6d1a8";
        ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, Math.PI * 2); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#a9a7c8"; ctx.font = "8px system-ui"; ctx.fillText(kind.toUpperCase(), (a.x + b.x) / 2 + 10, (a.y + b.y) / 2 - 5);
      }
      for (const exit of exits) {
        ctx.fillStyle = "rgba(90,190,144,.15)"; ctx.fillRect(exit.x - 12, exit.y - 23, 24, 23);
        ctx.strokeStyle = "#79d2a4"; ctx.lineWidth = 2;
        ctx.strokeRect(exit.x - 12, exit.y - 23, 24, 23);
        ctx.beginPath(); ctx.moveTo(exit.x, exit.y - 13); ctx.lineTo(exit.x + 17, exit.y - 13);
        ctx.lineTo(exit.x + 10, exit.y - 19); ctx.moveTo(exit.x + 17, exit.y - 13); ctx.lineTo(exit.x + 10, exit.y - 7); ctx.stroke();
        ctx.fillStyle = "#a4e0bb"; ctx.font = "8px system-ui"; ctx.fillText("EXIT", exit.x - 11, exit.y - 29);
      }
      ctx.restore();
    }

    function drawDebrisAndParticles(ctx) {
      ctx.save();
      for (const body of debris) {
        ctx.save(); ctx.translate(body.x, body.y); ctx.rotate(body.angle);
        const palette = { steel: "#aaa8ed", wood: "#bd9870", composite: "#79c6c4",
          explosiveComposite: "#d88d65", flammableComposite: "#cc9857", concrete: "#9c9eae" };
        ctx.fillStyle = palette[body.material] || "#aaa8ed";
        ctx.fillRect(-body.length * 0.5, -body.width * 0.5, body.length, body.width);
        ctx.strokeStyle = "rgba(13,12,25,.8)"; ctx.lineWidth = 1; ctx.strokeRect(-body.length * 0.5, -body.width * 0.5, body.length, body.width);
        ctx.restore();
      }
      for (const particle of particles) {
        const fade = clamp(particle.life / particle.maxLife, 0, 1);
        if (particle.kind === "smoke") {
          ctx.fillStyle = "rgba(82,82,96," + (0.22 * fade) + ")";
        } else if (particle.kind === "dust") {
          ctx.fillStyle = "rgba(190,174,146," + (0.32 * fade) + ")";
        } else if (particle.kind === "flame") {
          ctx.fillStyle = "rgba(255," + Math.round(95 + 115 * fade) + ",65," + (0.72 * fade) + ")";
        } else if (particle.kind === "spark") {
          ctx.fillStyle = "rgba(255,205,126," + (0.9 * fade) + ")";
        } else {
          ctx.fillStyle = particle.material === "wood" ? "rgba(191,146,92," + (0.72 * fade) + ")" :
            "rgba(167,174,190," + (0.72 * fade) + ")";
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.4, particle.radius), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function scaleWorld(sx, sy) {
      const scaleX = Math.max(0.1, finite(sx, 1));
      const scaleY = Math.max(0.1, finite(sy, 1));
      for (const link of connectors) {
        link.a.x *= scaleX; link.a.y *= scaleY;
        link.b.x *= scaleX; link.b.y *= scaleY;
        if (link.previousA) {
          link.previousA.x *= scaleX; link.previousA.y *= scaleY;
        }
        if (link.previousB) {
          link.previousB.x *= scaleX; link.previousB.y *= scaleY;
        }
        link.centerX *= scaleX; link.centerY *= scaleY;
        link.vx *= scaleX; link.vy *= scaleY;
        link.width *= (scaleX + scaleY) * 0.5;
        link.length = distance(link.a, link.b);
        link.restLength = link.length;
      }
      for (const exit of exits) { exit.x *= scaleX; exit.y *= scaleY; }
      for (const body of debris) {
        body.x *= scaleX; body.px *= scaleX;
        body.y *= scaleY; body.py *= scaleY;
        body.length *= (scaleX + scaleY) * 0.5;
        body.width *= (scaleX + scaleY) * 0.5;
        body.radius *= (scaleX + scaleY) * 0.5;
      }
      for (const particle of particles) {
        particle.x *= scaleX; particle.vx *= scaleX;
        particle.y *= scaleY; particle.vy *= scaleY;
        particle.radius *= (scaleX + scaleY) * 0.5;
      }
    }

    function captureNavigation() {
      return {
        connectors: connectors.map(link => ({
          id: link.id, kind: link.kind, a: { ...link.a }, b: { ...link.b },
          physicsEnabled: !!link.physicsEnabled,
          anchors: link.anchors ? {
            a: link.anchors.a ? { ...link.anchors.a } : null,
            b: link.anchors.b ? { ...link.anchors.b } : null
          } : null
        })),
        exits: exits.map(exit => ({ ...exit })),
        nextConnectorId, nextExitId
      };
    }

    function restoreNavigation(snapshot) {
      connectors.length = 0;
      exits.length = 0;
      const savedConnectors = Array.isArray(snapshot?.connectors) ? snapshot.connectors : [];
      const savedExits = Array.isArray(snapshot?.exits) ? snapshot.exits : [];
      const usedConnectorIds = new Set();
      const usedExitIds = new Set();
      for (const link of savedConnectors) {
        if (!link || !["ladder", "stairs", "elevator"].includes(link.kind) ||
            !link.a || !link.b || ![link.a.x, link.a.y, link.b.x, link.b.y].every(Number.isFinite) ||
            distance(link.a, link.b) < 28) continue;
        let id = Number.isInteger(link.id) && link.id > 0 && !usedConnectorIds.has(link.id)
          ? link.id : 1;
        while (usedConnectorIds.has(id)) id++;
        usedConnectorIds.add(id);
        const a = { x: link.a.x, y: link.a.y };
        const b = { x: link.b.x, y: link.b.y };
        const physicsEnabled = link.physicsEnabled === true;
        connectors.push({
          id, kind: link.kind, a, b,
          previousA: { ...a }, previousB: { ...b },
          physicsEnabled,
          anchors: physicsEnabled ? {
            a: normalizeConnectorAnchor(link.anchors?.a),
            b: normalizeConnectorAnchor(link.anchors?.b)
          } : null,
          falling: false, restLength: distance(a, b), length: distance(a, b),
          width: link.kind === "elevator" ? 28 : link.kind === "stairs" ? 9 : 3,
          centerX: (a.x + b.x) * 0.5, centerY: (a.y + b.y) * 0.5,
          angle: Math.atan2(b.y - a.y, b.x - a.x),
          vx: 0, vy: 0, angularVelocity: 0
        });
      }
      for (const exit of savedExits) {
        if (!exit || !Number.isFinite(exit.x) || !Number.isFinite(exit.y)) continue;
        let id = Number.isInteger(exit.id) && exit.id > 0 && !usedExitIds.has(exit.id)
          ? exit.id : 1;
        while (usedExitIds.has(id)) id++;
        usedExitIds.add(id);
        exits.push({ id, x: exit.x, y: exit.y });
      }
      nextConnectorId = Math.max(Math.max(0, ...usedConnectorIds) + 1,
        Math.floor(finite(snapshot?.nextConnectorId, 1)), 1);
      nextExitId = Math.max(Math.max(0, ...usedExitIds) + 1,
        Math.floor(finite(snapshot?.nextExitId, 1)), 1);
    }

    function clearDynamic() {
      debris.length = 0; particles.length = 0;
    }

    function clearAll() {
      clearDynamic();
      connectors.length = 0; exits.length = 0;
      nextConnectorId = 1; nextExitId = 1; nextDebrisId = 1;
      emittedParticleCount = 0; fractureCount = 0;
    }

    return {
      fractureMember, emitDust, emitSparks, emitSmoke, emitFlame, emitExplosion,
      step, updateConnectors, updateParticles, smokeDensityAt, fireIntensityAt, debrisClearanceAt,
      addConnector, addExit, removeNavigationAt, floorLevels, floorIndexAt,
      findRouteToExit, occupantPerception, drawNavigation, drawDebrisAndParticles,
      captureNavigation, restoreNavigation, scaleWorld, clearDynamic, clearAll,
      getDebrisCount: () => debris.length,
      getParticleCount: () => particles.length,
      getConnectorCount: kind => kind ? connectors.filter(link => link.kind === kind).length : connectors.length,
      getExitCount: () => exits.length,
      getFractureCount: () => fractureCount,
      getEmittedParticleCount: () => emittedParticleCount,
      getDebris: () => debris,
      getParticles: () => particles,
      getConnectors: () => connectors,
      getExits: () => exits
    };
  }

  const api = Object.freeze({ createWorldSystems, version: 1 });
  root.FrameLabs3WorldSystems = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
