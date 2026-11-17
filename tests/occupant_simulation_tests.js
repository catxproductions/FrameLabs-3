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
