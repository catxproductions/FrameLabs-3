const test = require("node:test");
const assert = require("node:assert/strict");
const AgentFive = require("../agent-five-fl3.js");
const { createWorldSystems } = require("../world-systems.js");
const { createPopulationSimulation } = require("../occupant-simulation.js");

function makeWorld() {
  const worldSystems = createWorldSystems();
  worldSystems.addConnector("stairs", { x: 100, y: 80 }, { x: 100, y: 180 });
  worldSystems.addExit({ x: 145, y: 180 });
  return worldSystems;
}

test("population spawns independent agents across available floors", () => {
  const worldSystems = makeWorld();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const spawned = population.spawn(6, { width: 500, ground: 180 });
  assert.equal(spawned.length, 6);
  assert.equal(population.getCount(), 6);
  assert.equal(new Set(spawned.map(agent => agent.id)).size, 6);
  assert.notEqual(spawned[0].brain.policy, spawned[1].brain.policy);
  assert.ok(new Set(spawned.map(agent => agent.floorY)).size > 1);
});

test("occupants follow navigation to exits and report successful evacuation", () => {
  const worldSystems = makeWorld();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  population.spawn(1, { width: 300, ground: 180 });
  const world = { width: 300, ground: 180, members: [], loads: [], materialProfiles: {} };
  for (let i = 0; i < 3600 && population.getEvacuatedCount() === 0; i++) {
    population.step(1 / 120, world);
  }
  assert.equal(population.getEvacuatedCount(), 1);
  assert.equal(population.getCount(), 1);
});

test("population cap, safe invalid deltas, and clear lifecycle", () => {
  const worldSystems = makeWorld();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  assert.equal(population.spawn(1000, { width: 600, ground: 180 }).length, 150);
  population.step(NaN, { width: 600, ground: 180, members: [] });
  assert.equal(population.getCount(), 150);
  population.clear();
  assert.equal(population.getCount(), 0);
  assert.equal(population.getEvacuatedCount(), 0);
});

test("population safely holds when no exit is reachable", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  population.spawn(2, { width: 400, ground: 180 });
  const world = { width: 400, ground: 180, members: [], loads: [], materialProfiles: {} };
  for (let i = 0; i < 120; i++) population.step(1 / 120, world);
  assert.equal(population.getEvacuatedCount(), 0);
  assert.ok(population.getOccupants().every(agent => Number.isFinite(agent.x + agent.y)));
});

test("upper-floor occupants traverse stairs and continue to a ground-floor exit", () => {
  const worldSystems = makeWorld();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const spawned = population.spawn(2, { width: 300, ground: 180 });
  const upperFloorOccupant = spawned.find(agent => agent.floorY === 80);
  assert.ok(upperFloorOccupant);
  const world = { width: 300, ground: 180, members: [], loads: [], materialProfiles: {} };
  for (let i = 0; i < 3600 && !upperFloorOccupant.evacuated; i++) {
    population.step(1 / 120, world);
  }
  assert.equal(upperFloorOccupant.evacuated, true);
  assert.equal(upperFloorOccupant.floorY, 180);
});

test("untrained neural jump output cannot launch occupants without a validated jump gate", () => {
  const worldSystems = createWorldSystems();
  worldSystems.addExit({ x: 280, y: 180 });
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  const world = { width: 300, ground: 180, members: [], loads: [], materialProfiles: {} };
  population.step(1 / 120, world);
  occupant.controls.jump = 1;
  population.step(1 / 120, world);
  assert.equal(occupant.grounded, true);
  assert.equal(occupant.y, occupant.floorY);
});

test("jump output is accepted only when a host validates a jump opportunity", () => {
  const worldSystems = createWorldSystems();
  worldSystems.addExit({ x: 280, y: 180 });
  const population = createPopulationSimulation({
    agentApi: AgentFive, worldSystems, canJump: () => true
  });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  const world = { width: 300, ground: 180, members: [], loads: [], materialProfiles: {} };
  population.step(1 / 120, world);
  occupant.controls.jump = 1;
  population.step(1 / 120, world);
  assert.equal(occupant.grounded, false);
});

test("gravity holds occupants on intact structural floors and drops them when the floor breaks", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  occupant.x = 150;
  occupant.y = 80;
  occupant.floorY = 80;
  occupant.grounded = true;
  const floor = {
    kind: "beam", broken: false, detached: false,
    points: [{ x: 0, y: 80 }, { x: 300, y: 80 }]
  };
  const world = { width: 300, ground: 180, members: [floor], loads: [], materialProfiles: {} };

  for (let i = 0; i < 120; i++) population.step(1 / 120, world);
  assert.equal(occupant.grounded, true);
  assert.ok(Math.abs(occupant.y - 80) < 0.01);

  floor.broken = true;
  for (let i = 0; i < 180; i++) population.step(1 / 120, world);
  assert.equal(occupant.grounded, true);
  assert.ok(Math.abs(occupant.y - 180) < 0.01);
  assert.ok(occupant.y > 80);
});


test("occupants cancel a stair traversal when that connector collapses", () => {
  const worldSystems = createWorldSystems();
  const connector = worldSystems.addConnector(
    "stairs", { x: 100, y: 80 }, { x: 100, y: 180 }
  );
  worldSystems.addExit({ x: 280, y: 180 });
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  // Place the occupant on an upper floor so gravity is observable immediately
  // after the connector disappears instead of landing on the ground this step.
  occupant.x = 100;
  occupant.y = 80;
  occupant.floorY = 80;
  occupant.grounded = true;
  occupant.traversal = {
    from: { x: 100, y: 80 },
    to: { x: 100, y: 180 },
    connectorId: connector.id,
    kind: "stairs",
    waitRemaining: 0
  };
  connector.falling = true;
  population.step(1 / 120, {
    width: 300, ground: 180, members: [], loads: [], materialProfiles: {}
  });
  assert.equal(occupant.traversal, null);
  assert.equal(occupant.grounded, false);
});


test("a 50-foot fall incapacitates an occupant on landing", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 400, ground: 540 });
  occupant.x = 200;
  occupant.y = 0;
  occupant.floorY = 0;
  occupant.grounded = false;
  const world = { width: 400, ground: 540, members: [], loads: [], materialProfiles: {} };

  for (let i = 0; i < 1200 && !occupant.brain.disabled; i++) population.step(1 / 120, world);

  assert.equal(occupant.grounded, true);
  assert.equal(occupant.brain.disabled, true);
  assert.equal(occupant.brain.disableReason, "hard-landing");
  assert.equal(occupant.health, 0);
  assert.equal(population.getDisabledCount(), 1);
});

test("a lower fall injures an occupant and reduces mobility without instant incapacitation", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 400, ground: 150 });
  occupant.x = 200;
  occupant.y = 0;
  occupant.floorY = 0;
  occupant.grounded = false;
  const world = { width: 400, ground: 150, members: [], loads: [], materialProfiles: {} };

  for (let i = 0; i < 600 && !occupant.grounded; i++) population.step(1 / 120, world);

  assert.equal(occupant.grounded, true);
  assert.ok(occupant.health < 100);
  assert.ok(occupant.health > 0);
  assert.equal(occupant.brain.disabled, false);
  assert.equal(population.getInjuredCount(), 1);
});

test("a fast heavy debris impact incapacitates an occupant", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  occupant.x = 150;
  occupant.y = 100;
  occupant.grounded = true;
  worldSystems.getDebris().push({
    id: 9001, x: 150, y: 95, px: 150, py: 85,
    angle: 0, previousAngle: 0, length: 100, width: 18,
    radius: 18, mass: 30, settled: false, age: 0
  });

  population.step(1 / 120, {
    width: 300, ground: 180, members: [], loads: [], materialProfiles: {}
  });

  assert.equal(occupant.brain.disabled, true);
  assert.equal(occupant.brain.disableReason, "excessive-impact-force");
  assert.equal(occupant.health, 0);
});

test("a pile of settled structural debris applies sustained crush load", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  occupant.x = 150;
  occupant.y = 100;
  occupant.grounded = true;
  for (let i = 0; i < 4; i++) {
    worldSystems.getDebris().push({
      id: 9100 + i, x: 150, y: 95, px: 150, py: 95,
      angle: 0, previousAngle: 0, length: 100, width: 18,
      radius: 18, mass: 40, settled: true, age: 1
    });
  }

  population.step(1 / 120, {
    width: 300, ground: 180, members: [], loads: [], materialProfiles: {}
  });

  assert.equal(occupant.brain.disabled, true);
  assert.equal(occupant.brain.disableReason, "crush-threshold");
  assert.equal(occupant.health, 0);
  assert.equal(occupant.crushLoadKg, 160);
});

test("a moving structural member can injure an occupant before it fractures", () => {
  const worldSystems = createWorldSystems();
  const population = createPopulationSimulation({ agentApi: AgentFive, worldSystems });
  const [occupant] = population.spawn(1, { width: 300, ground: 180 });
  occupant.x = 150;
  occupant.y = 100;
  occupant.grounded = true;
  const member = {
    id: 77, kind: "beam", broken: false, detached: false, memberMass: 40,
    points: [
      { x: 100, y: 95, px: 100, py: 75 },
      { x: 200, y: 95, px: 200, py: 75 }
    ]
  };

  population.step(1 / 120, {
    width: 300, ground: 180, members: [member], loads: [], materialProfiles: {}
  });

  assert.ok(occupant.health < 100);
  assert.ok(["moving-structure-impact", "falling-debris-impact"].includes(occupant.lastDamageReason) ||
    occupant.brain.disabled);
});
