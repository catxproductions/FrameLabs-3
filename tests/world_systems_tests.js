const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorldSystems } = require("../world-systems.js");

function member(material = "steel", x = 50, y = 30) {
  const points = Array.from({ length: 6 }, (_, i) => {
    const px = x + i * 24;
    return { x: px, y, px: px - 0.5, py: y - 0.2, radius: 2.6 };
  });
  return { id: 1, material, kind: "beam", points, rest: 120, memberMass: 1.2,
    broken: false, detached: false, temperature: 20 };
}

test("fracture releases two independent fragments and emits dust", () => {
  const systems = createWorldSystems();
  const beam = member();
  assert.equal(systems.fractureMember(beam, 2, 1 / 60), true);
  assert.equal(beam.broken, true);
  assert.equal(beam.detached, true);
  assert.equal(systems.getDebrisCount(), 2);
  assert.ok(systems.getParticleCount() > 0);
  assert.equal(systems.fractureMember(beam, 2), false);
});

test("debris inherits motion and falls to the ground", () => {
  const systems = createWorldSystems();
  const beam = member("steel");
  beam.points.forEach(point => { point.px = point.x - 2; point.py = point.y - 1; });
  systems.fractureMember(beam, 2, 1 / 60);
  const initialY = systems.getDebris()[0].y;
  for (let i = 0; i < 120; i++) systems.step(1 / 60, { ground: 100, width: 500, members: [], loads: [] });
  assert.ok(systems.getDebris()[0].y > initialY);
  assert.ok(systems.getDebris().every(body => Number.isFinite(body.x + body.y + body.angle)));
});

test("dust and smoke particles are bounded and smoke affects local density", () => {
  const systems = createWorldSystems();
  systems.emitDust(80, 50, 24, "concrete");
  systems.emitSmoke(80, 50, 8);
  assert.ok(systems.getParticleCount() >= 30);
  assert.ok(systems.smokeDensityAt(80, 50) > 0);
  for (let i = 0; i < 600; i++) systems.emitSmoke(80, 50, 2);
  assert.ok(systems.getParticleCount() <= 720);
});

test("fire adds heat, emits smoke, and spreads to nearby flammable members", () => {
  const systems = createWorldSystems();
  const burning = member("flammableComposite", 40, 40);
  const target = member("wood", 40, 50);
  burning.ignited = true;
  const profiles = {
    flammableComposite: { flammability: 1, ignitionTemperature: 240, burnRate: 200 },
    wood: { flammability: 1, ignitionTemperature: 90, burnRate: 110 }
  };
  for (let i = 0; i < 240; i++) systems.step(1 / 60, {
    ground: 300, width: 500, members: [burning, target], loads: [], materialProfiles: profiles
  });
  assert.ok(burning.temperature > 20);
  assert.ok(target.temperature > 20);
  assert.ok(systems.getParticleCount() > 0);
});

test("ladder, stairs, elevator and exit form multi-floor navigation routes", () => {
  const systems = createWorldSystems();
  systems.addConnector("stairs", { x: 100, y: 80 }, { x: 150, y: 180 });
  systems.addConnector("elevator", { x: 240, y: 80 }, { x: 240, y: 180 });
  systems.addConnector("ladder", { x: 320, y: 80 }, { x: 320, y: 180 });
  systems.addExit({ x: 360, y: 180 });
  assert.equal(systems.getConnectorCount("stairs"), 1);
  assert.equal(systems.getConnectorCount("elevator"), 1);
  assert.equal(systems.getConnectorCount("ladder"), 1);
  const route = systems.findRouteToExit(130, 80, 180);
  assert.ok(route);
  assert.equal(route.floor, 1);
  assert.equal(route.floorDifference, -1);
  assert.ok(route.distance > 0);
});

test("Agent Five observation adapter exposes FL3 floor and exit sensors", () => {
  const systems = createWorldSystems();
  systems.addConnector("stairs", { x: 100, y: 80 }, { x: 100, y: 180 });
  systems.addExit({ x: 125, y: 180 });
  const observation = systems.occupantPerception(80, 80, {}, { ground: 180, members: [] });
  assert.equal(observation.currentFloor, 2);
  assert.ok(observation.distanceFromExit > 0);
  assert.equal(observation.floorDifferenceToExit, -1);
  assert.equal(observation.exitDirection, 1);
});

test("navigation snapshots restore links and exits", () => {
  const systems = createWorldSystems();
  systems.addConnector("ladder", { x: 20, y: 40 }, { x: 20, y: 120 });
  systems.addExit({ x: 30, y: 120 });
  const snapshot = systems.captureNavigation();
  systems.clearAll();
  systems.restoreNavigation(snapshot);
  assert.equal(systems.getConnectorCount(), 1);
  assert.equal(systems.getExitCount(), 1);
});

test("navigation items can be deleted by clicking their marker", () => {
  const systems = createWorldSystems();
  systems.addExit({ x: 30, y: 40 });
  assert.equal(systems.removeNavigationAt(30, 40), true);
  assert.equal(systems.getExitCount(), 0);
});

test("route queries do not mutate saved navigation objects", () => {
  const systems = createWorldSystems();
  systems.addConnector("stairs", { x: 100, y: 80 }, { x: 100, y: 180 });
  systems.addExit({ x: 130, y: 180 });
  const before = systems.captureNavigation();
  for (let i = 0; i < 8; i++) assert.ok(systems.findRouteToExit(40, 80, 180));
  assert.deepEqual(systems.captureNavigation(), before);
  assert.equal("nodeA" in systems.getConnectors()[0], false);
  assert.equal("nodeIndex" in systems.getExits()[0], false);
});

test("particle emission is bounded and ignores invalid time steps", () => {
  const systems = createWorldSystems();
  systems.emitDust(20, 30, 1e9, "concrete");
  systems.emitSmoke(20, 30, 1e9);
  assert.ok(systems.getParticleCount() <= 200);
  systems.updateParticles(NaN, { wind: Infinity });
  assert.ok(systems.getParticles().every(p =>
    [p.x, p.y, p.vx, p.vy, p.radius, p.life].every(Number.isFinite)
  ));
});

test("navigation restore rejects malformed links and keeps generated ids unique", () => {
  const systems = createWorldSystems();
  systems.restoreNavigation({
    connectors: [
      { id: 0, kind: "stairs", a: { x: 10, y: 20 }, b: { x: 10, y: 90 } },
      { id: 1, kind: "ladder", a: { x: 30, y: 20 }, b: { x: 30, y: 90 } },
      { id: 1, kind: "elevator", a: { x: 50, y: 20 }, b: { x: 50, y: 90 } },
      { id: 4, kind: "stairs", a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }
    ],
    exits: [{ id: 0, x: 100, y: 90 }, { id: 1, x: 130, y: 90 }]
  });
  assert.equal(systems.getConnectorCount(), 3);
  assert.equal(systems.getExitCount(), 2);
  const connectorIds = systems.getConnectors().map(link => link.id);
  const exitIds = systems.getExits().map(exit => exit.id);
  assert.equal(new Set(connectorIds).size, connectorIds.length);
  assert.equal(new Set(exitIds).size, exitIds.length);
  const added = systems.addConnector("stairs", { x: 180, y: 20 }, { x: 180, y: 90 });
  assert.ok(added);
  assert.ok(!connectorIds.includes(added.id));
});


test("stairs and elevator shafts follow supported structure and fall when an attachment fails", () => {
  for (const kind of ["stairs", "elevator"]) {
    const systems = createWorldSystems();
    const members = [
      {
        id: 11, kind: "beam", broken: false, detached: false,
        points: [{ x: 120, y: 80 }, { x: 220, y: 80 }]
      },
      {
        id: 12, kind: "beam", broken: false, detached: false,
        points: [{ x: 120, y: 180 }, { x: 220, y: 180 }]
      }
    ];
    const link = systems.addConnector(
      kind,
      { x: 140, y: 80 },
      { x: 140, y: 180 },
      {
        a: { type: "member", id: 11, segmentIndex: 0, t: 0.2 },
        b: { type: "member", id: 12, segmentIndex: 0, t: 0.2 }
      }
    );
    assert.ok(link);
    systems.updateConnectors(1 / 120, { width: 400, ground: 300, nodes: [], members });
    assert.equal(link.falling, false);
    assert.ok(Math.abs(link.a.y - 80) < 0.01);

    // The whole connector follows both landings while the supporting structure
    // moves, rather than remaining pinned to its original build coordinates.
    for (const point of members[0].points) point.y += 10;
    for (const point of members[1].points) point.y += 10;
    systems.updateConnectors(1 / 120, { width: 400, ground: 300, nodes: [], members });
    assert.ok(Math.abs(link.a.y - 90) < 0.01);
    assert.ok(Math.abs(link.b.y - 190) < 0.01);

    // After the upper landing fails, the connector drops onto the still-intact
    // lower landing instead of passing through it.
    members[0].broken = true;
    members[0].detached = true;
    for (let i = 0; i < 30; i++) {
      systems.updateConnectors(1 / 120, { width: 400, ground: 300, nodes: [], members });
    }
    assert.equal(link.falling, true);
    assert.ok(Math.abs(link.b.y - 190) < 1);

    // Once the remaining landing fails, the whole assembly continues to ground.
    members[1].broken = true;
    members[1].detached = true;
    for (let i = 0; i < 90; i++) {
      systems.updateConnectors(1 / 120, { width: 400, ground: 300, nodes: [], members });
    }
    assert.ok(link.a.y > 90);
    assert.ok(link.b.y > 190);
    assert.ok(Number.isFinite(link.vy));
  }
});

test("unattached navigation connectors fall in the simulation instead of remaining suspended", () => {
  const systems = createWorldSystems();
  const link = systems.addConnector(
    "stairs",
    { x: 100, y: 60 },
    { x: 160, y: 110 },
    { a: null, b: null }
  );
  systems.updateConnectors(1 / 60, { width: 400, ground: 300, nodes: [], members: [] });
  assert.equal(link.falling, true);
  assert.ok(link.a.y > 60);
  assert.ok(link.b.y > 110);
});
