const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../agent-five-fl3.js');
const perception = () => ({
  distanceFromFloor:0,currentFloor:1,distanceFromWall:180,temperature:20,fallingSpeed:0,
  distanceFromFallingObject:400,panic:0,horizontalSpeed:0,distanceFromExit:300,exitDirection:-1,
  floorDifferenceToExit:0,smokeDensity:0,fireIntensity:0,structuralDanger:0,
  nearbyOccupantDensity:0.1,debrisClearance:300
});
test('Agent Five topology retained with 16 inputs and four outputs',()=>{
  assert.equal(AI.inputCount,16);assert.equal(AI.outputCount,4);assert.equal(AI.hiddenLayers.length,26);
  assert.deepEqual(AI.hiddenLayers,[15,16,15,14,15,13,14,12,13,11,12,10,11,12,10,9,10,8,9,7,8,6,7,5,6,4]);
  assert.deepEqual(new AI.NeuralNetwork(null,4).sizes,[16,...AI.hiddenLayers,4]);
  assert.deepEqual(new AI.NeuralNetwork(null,1).sizes,[16,...AI.hiddenLayers,1]);
});
test('normalizes all 16 FL3 sensors to finite values in range',()=>{
  const v=AI.normalizePerception(perception());assert.equal(v.length,16);
  assert.ok(v.every(x=>Number.isFinite(x)&&x>=-1&&x<=1));assert.equal(v[6],-1);assert.equal(v[9],-1);
  assert.throws(()=>AI.normalizePerception([1,2]),/exactly 16/);
});
test('returns four independent controls and gates jump at 0.5',()=>{
  const b=new AI.OccupantBrain(),d=b.decide(perception());
  assert.deepEqual(Object.keys(d.controls),['thrustLeft','thrustRight','brake','jump']);
  for(const v of Object.values(d.controls))assert.ok(v>=0&&v<=1);
  assert.equal(AI.shouldJump({jump:0.49},true,true),false);
  assert.equal(AI.shouldJump({jump:0.5},true,true),true);
  assert.equal(AI.shouldJump({jump:0.9},false,true),false);
  assert.equal(AI.shouldJump({jump:0.9},true,false),false);
});
test('100 percent panic disables the occupant',()=>{
  const b=new AI.OccupantBrain();b.setPanic(1);const d=b.decide(perception());
  assert.equal(d.disabled,true);assert.equal(d.controls,null);assert.equal(d.reason,'panic-limit');
});
test('landing, stampede, impact and crush thresholds disable occupant',()=>{
  for(const [field,reason] of [['landingImpact','hard-landing'],['stampedeImpact','stampeded'],
    ['impactForce','excessive-impact-force'],['crushForce','crush-threshold']]){
    const b=new AI.OccupantBrain();assert.equal(b.reportPhysicalStress({[field]:1}),true);
    assert.equal(b.decide(perception()).reason,reason);
  }
});
test('four-output PPO trains the policy and separate critic',()=>{
  const b=new AI.OccupantBrain();
  for(let i=0;i<AI.rolloutSize;i++){b.decide(perception());b.recordOutcome(i%2?-.1:.2,i%2?'experience':'hazard-avoidance');}
  assert.equal(b.rollout.length,0);assert.equal(b.trainingUpdates,AI.rolloutSize*2);
  assert.equal(b.lastTrainingStats.samples,AI.rolloutSize);
});
test('brain export and import preserve FL3 architecture without sharing weights',()=>{
  const b=new AI.OccupantBrain({id:'portable'}),saved=b.export(),copy=AI.OccupantBrain.import(saved);
  assert.equal(copy.id,'portable');assert.deepEqual(copy.policy.sizes,b.policy.sizes);
  assert.notEqual(copy.policy.weights[0],b.policy.weights[0]);assert.throws(()=>AI.OccupantBrain.import({}),/Unsupported/);
});
test('population descendants receive independent actor and critic copies',()=>{
  const parent=new AI.OccupantBrain({id:'parent'}),agents=AI.createPopulation(3,{parent,mutationRate:.08});
  assert.equal(agents.length,3);assert.equal(agents[0].id,'occupant-1');
  assert.notEqual(agents[0].policy,parent.policy);assert.notEqual(agents[0].policy.weights[0],parent.policy.weights[0]);
});
