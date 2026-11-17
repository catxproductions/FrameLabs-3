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
