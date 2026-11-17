/*
 * FrameLabs 3 - Agent Five occupant brain.
 * Adapted from Agent Five v8: same 16-input / 26-hidden-layer topology,
 * tanh fully-connected networks, separate value critic and PPO/GAE learning.
 * FL3 changes the observation meanings and actor head to four controls.
 */
(function (root) {
  "use strict";
  const VERSION = 1, INPUTS = 16, OUTPUTS = 4;
  const HIDDEN_LAYERS = [15,16,15,14,15,13,14,12,13,11,12,10,11,12,10,9,10,8,9,7,8,6,7,5,6,4];
  const INPUT_NAMES = [
    "distanceFromFloor", "currentFloor", "distanceFromWall", "temperature",
    "fallingSpeed", "distanceFromFallingObject", "panic", "horizontalSpeed",
    "distanceFromExit", "exitDirection", "floorDifferenceToExit", "smokeDensity",
    "fireIntensity", "structuralDanger", "nearbyOccupantDensity", "debrisClearance"
  ];
  const OUTPUT_NAMES = ["thrustLeft", "thrustRight", "brake", "jump"];
  const MEMORY_CAPACITY = 192, EPISODE_CAPACITY = 48, EPISODE_LENGTH = 12, ROLLOUT_SIZE = 64;
  const PPO = { gamma:0.99, gaeLambda:0.95, clipRange:0.2, policyRate:0.00045,
    valueRate:0.0012, policyStandardDeviation:0.2, epochs:2, minibatchSize:32 };
  const FEATURE_WEIGHTS = [1,0.7,1,1.35,1.25,1.4,1.7,0.75,1.1,0.9,0.85,1.45,1.55,1.7,0.7,1.3];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const signed = (v, range) => clamp(num(v)/Math.max(1e-6,range),-1,1);
  const unsigned = (v, range) => clamp(num(v)/Math.max(1e-6,range),0,1)*2-1;

  function normalizePerception(p, panicOverride) {
    if (Array.isArray(p)) {
      if (p.length !== INPUTS || !p.every(Number.isFinite)) throw new TypeError("FL3 perception must contain exactly 16 finite values.");
      return p.map(v=>clamp(v,-1,1));
    }
    if (!p || typeof p !== "object") throw new TypeError("FL3 perception must be an object or a 16-value array.");
    const s=p.scale||{}, ambient=num(s.ambientTemperature,20);
    const maxTemp=Math.max(ambient+1,num(s.maxTemperature,1000));
    const exitDir=p.exitDirection && typeof p.exitDirection==="object" ? num(p.exitDirection.x) : num(p.exitDirection);
    const panic=clamp(num(panicOverride,num(p.panic)),0,1);
    const values=[
      unsigned(p.distanceFromFloor,num(s.maxFloorDistance,400)),
      unsigned(p.currentFloor,num(s.maxFloor,10)),
      unsigned(p.distanceFromWall ?? num(s.maxWallDistance,400),num(s.maxWallDistance,400)),
      signed(((num(p.temperature,ambient)-ambient)/(maxTemp-ambient))*2-1,1),
      unsigned(p.fallingSpeed,num(s.maxFallingSpeed,20)),
      unsigned(p.distanceFromFallingObject ?? num(s.maxFallingObjectDistance,400),num(s.maxFallingObjectDistance,400)),
      panic*2-1,
      signed(p.horizontalSpeed,num(s.maxHorizontalSpeed,12)),
      unsigned(p.distanceFromExit ?? num(s.maxExitDistance,1200),num(s.maxExitDistance,1200)),
      signed(exitDir,1),
      signed(p.floorDifferenceToExit,num(s.maxFloorDifference,10)),
      clamp(num(p.smokeDensity),0,1)*2-1,
      clamp(num(p.fireIntensity),0,1)*2-1,
      clamp(num(p.structuralDanger),0,1)*2-1,
      clamp(num(p.nearbyOccupantDensity),0,1)*2-1,
      unsigned(p.debrisClearance ?? num(s.maxDebrisClearance,400),num(s.maxDebrisClearance,400))
    ];
    if (values.length!==INPUTS || !values.every(Number.isFinite)) throw new Error("Invalid FL3 neural observation.");
    return values.map(v=>clamp(v,-1,1));
  }

  class NeuralNetwork {
    constructor(saved=null, outputSize=OUTPUTS) {
      this.outputSize=outputSize;
      this.modelType=outputSize===1?"critic":"policy";
      this.sizes=[INPUTS,...HIDDEN_LAYERS,outputSize];
      if (saved && this.isValid(saved)) {
        this.weights=saved.weights.map(m=>m.map(r=>r.slice()));
        this.biases=saved.biases.map(v=>v.slice());
      } else {
        this.weights=[]; this.biases=[];
        for(let l=0;l<this.sizes.length-1;l++) {
          const fanIn=this.sizes[l], fanOut=this.sizes[l+1], limit=Math.sqrt(6/(fanIn+fanOut));
          this.weights.push(Array.from({length:fanIn},()=>Array.from({length:fanOut},()=> (Math.random()*2-1)*limit)));
          this.biases.push(Array(fanOut).fill(0));
        }
      }
    }
    isValid(d) {
      return !!(d && d.version===VERSION && d.modelType===this.modelType &&
        Array.isArray(d.architecture) && d.architecture.length===this.sizes.length &&
        d.architecture.every((v,i)=>v===this.sizes[i]) &&
        Array.isArray(d.weights) && Array.isArray(d.biases) &&
        d.weights.length===this.sizes.length-1 && d.biases.length===this.sizes.length-1 &&
        d.weights.every((m,l)=>Array.isArray(m) && m.length===this.sizes[l] &&
          m.every(r=>Array.isArray(r) && r.length===this.sizes[l+1] && r.every(Number.isFinite))) &&
        d.biases.every((v,l)=>Array.isArray(v) && v.length===this.sizes[l+1] && v.every(Number.isFinite)));
    }
    forward(input) {
      if (!Array.isArray(input)||input.length!==INPUTS||!input.every(Number.isFinite))
        throw new TypeError("Network expects exactly 16 finite inputs.");
      const activations=[input];
      for(let l=0;l<this.weights.length;l++) {
        const prior=activations[l];
        const next=this.biases[l].map((bias,j)=>{
          let sum=bias;
          for(let i=0;i<prior.length;i++) sum+=prior[i]*this.weights[l][i][j];
          return Math.tanh(sum);
        });
        activations.push(next);
      }
      return {output:activations[activations.length-1],activations};
    }
    export() {
      return {version:VERSION,modelType:this.modelType,architecture:this.sizes.slice(),
        weights:this.weights.map(m=>m.map(r=>r.slice())),biases:this.biases.map(v=>v.slice())};
    }
    applyTrainedModel(model) {
      if(!this.isValid(model)) return false;
      this.weights=model.weights.map(m=>m.map(r=>r.slice()));
      this.biases=model.biases.map(v=>v.slice());
      return true;
    }
  }

  function cloneNetwork(network, mutationRate=0, mutationStrength=0.1) {
    const saved=network.export();
    const mutate=v=>clamp(v+(Math.random()<mutationRate?(Math.random()*2-1)*mutationStrength:0),-4,4);
    const weights=saved.weights.map(m=>m.map(r=>r.map(mutate)));
    const biases=saved.biases.map(v=>v.map(mutate));
    return new NeuralNetwork({...saved,weights,biases},network.outputSize);
  }

  function applyGradient(model,input,gradient,rate) {
    const pass=model.forward(input), deltas=Array(model.weights.length), last=deltas.length-1;
    deltas[last]=pass.output.map((v,i)=>clamp(gradient[i],-5,5)*(1-v*v));
    for(let l=last-1;l>=0;l--) {
      deltas[l]=pass.activations[l+1].map((v,i)=>{
        let propagated=0;
        for(let j=0;j<deltas[l+1].length;j++) propagated+=model.weights[l+1][i][j]*deltas[l+1][j];
        return propagated*(1-v*v);
      });
    }
    for(let l=0;l<model.weights.length;l++) {
      for(let i=0;i<model.weights[l].length;i++) for(let j=0;j<deltas[l].length;j++)
        model.weights[l][i][j]=clamp(model.weights[l][i][j]+rate*deltas[l][j]*pass.activations[l][i],-4,4);
      for(let j=0;j<deltas[l].length;j++) model.biases[l][j]=clamp(model.biases[l][j]+rate*deltas[l][j],-4,4);
    }
  }
  const normal=()=>{let a=0,b=0;while(!a)a=Math.random();while(!b)b=Math.random();return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b);};
  function logProbability(latent,mean,std) {
    const variance=std*std; let total=0;
    for(let i=0;i<latent.length;i++){const d=latent[i]-mean[i];total+=-0.5*(d*d/variance)-Math.log(std*Math.sqrt(2*Math.PI));}
    return total;
  }
  function sampleAction(policy,critic,inputs,meanOverride,std=0.2,pass=null) {
    const output=(pass||policy.forward(inputs)).output;
    const mean=Array.isArray(meanOverride)&&meanOverride.length===OUTPUTS?meanOverride.map(v=>clamp(v,-0.98,0.98)):output.slice();
    std=clamp(num(std,0.2),0.05,0.5);
    const latent=mean.map(v=>v+normal()*std), squashed=latent.map(Math.tanh);
    const controls={thrustLeft:(squashed[0]+1)/2,thrustRight:(squashed[1]+1)/2,brake:(squashed[2]+1)/2,jump:(squashed[3]+1)/2};
    return {controls,latent,mean,meanOffset:mean.map((v,i)=>v-output[i]),logProbability:logProbability(latent,mean,std),
      value:critic.forward(inputs).output[0],activations:(pass||policy.forward(inputs)).activations};
  }
  function trainPPO(policy,critic,rollout,overrides={}) {
    const options={...PPO,...overrides};
    const samples=rollout.filter(x=>x && x.inputs?.length===INPUTS && x.latent?.length===OUTPUTS &&
      x.meanOffset?.length===OUTPUTS && Number.isFinite(x.reward) && Number.isFinite(x.value));
    if(!samples.length)return {policy,critic,stats:{updates:0,samples:0,meanReward:0}};
    const advantages=Array(samples.length).fill(0), returns=Array(samples.length).fill(0);
    let nextValue=0,gae=0;
    for(let i=samples.length-1;i>=0;i--){
      const item=samples[i], next=item.done?0:(i===samples.length-1?clamp(item.nextValue||0,-1,1):nextValue);
      const delta=item.reward+options.gamma*next-item.value;
      gae=delta+options.gamma*options.gaeLambda*(item.done?0:1)*gae;
      advantages[i]=gae; returns[i]=clamp(gae+item.value,-1,1); nextValue=item.value;
    }
    const avg=advantages.reduce((a,b)=>a+b,0)/advantages.length;
    const std=Math.sqrt(advantages.reduce((a,b)=>a+(b-avg)*(b-avg),0)/advantages.length)+1e-6;
    const normalized=advantages.map(v=>clamp((v-avg)/std,-4,4));
    const deviation=clamp(options.policyStandardDeviation,0.05,0.5);
    let updates=0;
    for(let epoch=0;epoch<options.epochs;epoch++){
      const order=Array.from({length:samples.length},(_,i)=>i);
      for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      for(const index of order){
        const item=samples[index], base=policy.forward(item.inputs).output;
        const mean=base.map((v,i)=>clamp(v+item.meanOffset[i],-0.98,0.98));
        const ratio=Math.exp(clamp(logProbability(item.latent,mean,deviation)-item.logProbability,-5,5));
        const advantage=normalized[index], clipped=clamp(ratio,1-options.clipRange,1+options.clipRange);
        const objective=ratio*advantage<=clipped*advantage?ratio*advantage:0;
        const gradient=mean.map((v,i)=>clamp(objective*(item.latent[i]-v)/(deviation*deviation),-5,5));
        applyGradient(policy,item.inputs,gradient,options.policyRate);
        const value=critic.forward(item.inputs).output[0];
        applyGradient(critic,item.inputs,[clamp(returns[index]-value,-1,1)],options.valueRate);
        updates++;
      }
    }
    return {policy,critic,stats:{updates,samples:samples.length,meanReward:samples.reduce((a,x)=>a+x.reward,0)/samples.length,meanAdvantage:avg}};
  }

  function similarity(a,b) {
    let d=0,w=0;for(let i=0;i<INPUTS;i++){d+=(a[i]-b[i])**2*FEATURE_WEIGHTS[i];w+=FEATURE_WEIGHTS[i];}
    return Math.exp(-2.4*Math.sqrt(d/w));
  }
  function age(item){return Math.pow(0.5,Math.max(0,Date.now()-item.createdAt)/86400000/45);}
  class ExperienceMemory {
    constructor(saved=[]) {
      this.items=(Array.isArray(saved)?saved:[]).filter(x=>x?.inputs?.length===INPUTS&&x?.target?.length===OUTPUTS&&
        x.inputs.every(Number.isFinite)&&x.target.every(Number.isFinite)&&typeof x.outcome==="string").slice(-MEMORY_CAPACITY)
        .map(x=>({...x,inputs:x.inputs.slice(),target:x.target.slice()}));
    }
    add(inputs,target,outcome) {
      const found=this.items.find(x=>x.outcome===outcome&&similarity(x.inputs,inputs)>=0.985);
      if(found){found.occurrences=(found.occurrences||1)+1;found.priority=Math.min(4,(found.priority||1)+0.2);found.createdAt=Date.now();return found;}
      const priority=outcome==="safe-exit"||outcome==="hazard-avoidance"?3:
        outcome==="collision"||outcome==="impact"?2.4:outcome==="panic-disabled"?2.2:1.4;
      const item={inputs:inputs.slice(),target:target.slice(),outcome:String(outcome||"experience"),priority,
        createdAt:Date.now(),lastUsedAt:0,replayCount:0,occurrences:1};
      this.items.push(item);
      if(this.items.length>MEMORY_CAPACITY){this.items.sort((a,b)=>(b.priority*age(b)+Math.min(b.occurrences,16)*0.02)-(a.priority*age(a)+Math.min(a.occurrences,16)*0.02));this.items.length=MEMORY_CAPACITY;}
      return item;
    }
    recall(inputs) {
      const matches=this.items.map(item=>({item,score:similarity(inputs,item.inputs)})).filter(x=>x.score>=0.72)
        .sort((a,b)=>b.score-a.score).slice(0,4);
      if(!matches.length)return {output:null,strength:0,count:0};
      const result=Array(OUTPUTS).fill(0);let total=0;
      for(const m of matches){const weight=Math.pow(m.score,6)*m.item.priority*age(m.item);total+=weight;
        for(let i=0;i<OUTPUTS;i++)result[i]+=m.item.target[i]*weight;
        m.item.lastUsedAt=Date.now();m.item.replayCount=(m.item.replayCount||0)+1;}
      for(let i=0;i<OUTPUTS;i++)result[i]/=Math.max(1e-9,total);
      return {output:result,strength:0.18*clamp((matches[0].score-0.72)/0.28,0,1),count:matches.length};
    }
    export(){return this.items.map(x=>({...x,inputs:x.inputs.slice(),target:x.target.slice()}));}
  }
  class EpisodicMemory {
    constructor(saved=[]) {
      this.items=(Array.isArray(saved)?saved:[]).filter(x=>Array.isArray(x?.steps)&&x.steps.length>=3&&typeof x.outcome==="string")
        .slice(-EPISODE_CAPACITY).map(x=>({...x,steps:x.steps.slice(-EPISODE_LENGTH).map(s=>({...s,inputs:s.inputs.slice(),target:s.target.slice()}))}));
    }
    remember(trajectory,outcome) {
      if(trajectory.length<3)return false;
      this.items.push({steps:trajectory.slice(-EPISODE_LENGTH).map(x=>({...x,inputs:x.inputs.slice(),target:x.target.slice()})),
        outcome,priority:outcome==="safe-exit"?3.2:2.4,createdAt:Date.now(),uses:0});
      if(this.items.length>EPISODE_CAPACITY)this.items.shift();
      return true;
    }
    recall(inputs) {
      let best=null;
      for(const episode of this.items)for(const step of episode.steps){
        const score=similarity(inputs,step.inputs);
        if(score>=0.78&&(!best||score*episode.priority>best.score))best={score:score*episode.priority,similarity:score,target:step.target,episode};
      }
      if(!best)return {output:null,strength:0,count:0};
      best.episode.uses=(best.episode.uses||0)+1;
      return {output:best.target.slice(),strength:0.12*clamp((best.similarity-0.78)/0.22,0,1),count:1};
    }
    export(){return this.items.map(x=>({...x,steps:x.steps.map(s=>({...s,inputs:s.inputs.slice(),target:s.target.slice()}))}));}
  }

  class OccupantBrain {
    constructor(options={}) {
      this.id=String(options.id||"occupant-1");
      this.policy=options.policy?new NeuralNetwork(options.policy,OUTPUTS):new NeuralNetwork(null,OUTPUTS);
      this.critic=options.critic?new NeuralNetwork(options.critic,1):new NeuralNetwork(null,1);
      this.memory=new ExperienceMemory(options.memory);this.episodes=new EpisodicMemory(options.episodes);
      this.rollout=[];this.trajectory=[];this.lastDecision=null;this.panic=clamp(num(options.panic),0,1);
      this.disabled=!!options.disabled||this.panic>=1;this.disableReason=options.disableReason||(this.panic>=1?"panic-limit":this.disabled?"disabled":null);
      this.decisions=0;this.trainingUpdates=0;this.lastTrainingStats=null;
      this.policyStandardDeviation=clamp(num(options.policyStandardDeviation,0.2),0.05,0.5);
      this.trainingOptions=options.trainingOptions||{};
    }
    setPanic(value){this.panic=clamp(num(value,this.panic),0,1);if(this.panic>=1)this.disable("panic-limit");return this.panic;}
    updatePanicFromEnvironment(p,dt=0) {
      if(Number.isFinite(p.panic))return this.setPanic(p.panic);
      const thermal=clamp((num(p.temperature,20)-45)/500,0,1),smoke=clamp(num(p.smokeDensity),0,1);
      const fire=clamp(num(p.fireIntensity),0,1),structure=clamp(num(p.structuralDanger),0,1);
      const falling=clamp(num(p.fallingSpeed)/16,0,1),danger=Math.max(thermal,smoke*0.95,fire,structure*0.9,falling*0.55);
      return this.setPanic(this.panic+(0.24*danger-0.045*(1-danger))*Math.max(0,dt));
    }
    decide(perception,dt=0) {
      if(!perception||typeof perception!=="object")throw new TypeError("decide requires an FL3 perception object.");
      this.updatePanicFromEnvironment(perception,dt);
      if(this.disabled)return {id:this.id,disabled:true,panic:this.panic,controls:null,reason:this.disableReason||"disabled"};
      const inputs=normalizePerception(perception,this.panic),pass=this.policy.forward(inputs);
      const mem=this.memory.recall(inputs),episode=this.episodes.recall(inputs);let mean=pass.output.slice();
      if(mem.output&&mem.strength)mean=mean.map((v,i)=>v*(1-mem.strength)+mem.output[i]*mem.strength);
      if(episode.output&&episode.strength)mean=mean.map((v,i)=>v*(1-episode.strength)+episode.output[i]*episode.strength);
      const action=sampleAction(this.policy,this.critic,inputs,mean,this.policyStandardDeviation,pass);
      if(this.rollout.length&&!this.rollout[this.rollout.length-1].done)this.rollout[this.rollout.length-1].nextValue=clamp(action.value,-1,1);
      const transition={inputs:inputs.slice(),latent:action.latent.slice(),meanOffset:action.meanOffset.slice(),
        logProbability:action.logProbability,value:action.value,reward:0,done:false,nextValue:0};
      this.rollout.push(transition);this.trajectory.push({inputs:inputs.slice(),target:action.mean.slice(),reward:0});
      if(this.trajectory.length>EPISODE_LENGTH)this.trajectory.shift();
      this.lastDecision={transition,action,inputs};this.decisions++;
      return {id:this.id,disabled:false,panic:this.panic,inputs,controls:{...action.controls},value:action.value,
        memoryRecallCount:mem.count+episode.count,activations:action.activations};
    }
    recordOutcome(reward,outcome="experience",options={}) {
      if(!this.lastDecision)return false;
      const d=this.lastDecision,amount=clamp(num(reward),-8,8);
      d.transition.reward=clamp(d.transition.reward+amount,-8,8);
      const last=this.trajectory[this.trajectory.length-1];if(last)last.reward=clamp(last.reward+amount,-8,8);
      this.memory.add(d.inputs,d.action.mean,outcome);this.lastDecision=null;
      if(options.terminal){d.transition.done=true;d.transition.nextValue=0;this.episodes.remember(this.trajectory,outcome);this.trajectory=[];}
      if(this.rollout.length>=ROLLOUT_SIZE||(options.terminal&&this.rollout.length))this.train();
      return true;
    }
    train() {
      if(!this.rollout.length)return {updates:0,samples:0};
      const result=trainPPO(this.policy,this.critic,this.rollout,this.trainingOptions);
      this.policy=result.policy;this.critic=result.critic;this.lastTrainingStats=result.stats;
      this.trainingUpdates+=result.stats.updates;this.rollout=[];return result.stats;
    }
    reportPhysicalStress(stress={}) {
      if(this.disabled)return true;
      for(const [field,reason] of [["landingImpact","hard-landing"],["stampedeImpact","stampeded"],
        ["impactForce","excessive-impact-force"],["crushForce","crush-threshold"]]){
        if(Number.isFinite(stress[field])&&stress[field]>=1){this.disable(reason);return true;}
      }
      return false;
    }
    disable(reason="disabled"){this.disabled=true;this.disableReason=String(reason);return true;}
    clone(options={}) {
      const rate=clamp(num(options.mutationRate),0,1),strength=clamp(num(options.mutationStrength,0.1),0,1);
      return new OccupantBrain({id:options.id||this.id+"-clone",
        policy:cloneNetwork(this.policy,rate,strength).export(),critic:cloneNetwork(this.critic,rate,strength).export(),
        memory:this.memory.export(),episodes:this.episodes.export(),policyStandardDeviation:this.policyStandardDeviation,
        trainingOptions:this.trainingOptions});
    }
    export() {
      return {schema:"framelabs3-agent-five-brain",version:VERSION,id:this.id,architecture:[INPUTS,...HIDDEN_LAYERS,OUTPUTS],
        policy:this.policy.export(),critic:this.critic.export(),memory:this.memory.export(),episodes:this.episodes.export(),
        panic:this.panic,disabled:this.disabled,disableReason:this.disableReason,decisions:this.decisions,
        trainingUpdates:this.trainingUpdates,policyStandardDeviation:this.policyStandardDeviation};
    }
    static import(data) {
      if(!data||data.schema!=="framelabs3-agent-five-brain"||data.version!==VERSION)throw new TypeError("Unsupported FL3 Agent Five brain.");
      const actor=new NeuralNetwork(null,OUTPUTS),critic=new NeuralNetwork(null,1);
      if(!actor.isValid(data.policy)||!critic.isValid(data.critic))throw new TypeError("Incompatible FL3 Agent Five architecture.");
      return new OccupantBrain(data);
    }
  }
  function shouldJump(controls,grounded,cooldownReady=true) {
    return !!(controls&&Number.isFinite(controls.jump)&&controls.jump>=0.5&&grounded&&cooldownReady);
  }
  function createPopulation(size,options={}) {
    const count=Math.max(1,Math.min(300,Math.floor(num(size,1)))),parent=options.parent instanceof OccupantBrain?options.parent:null;
    const rate=clamp(num(options.mutationRate,parent?0.08:0),0,1),strength=clamp(num(options.mutationStrength,0.1),0,1);
    return Array.from({length:count},(_,i)=>parent?
      parent.clone({id:"occupant-"+(i+1),mutationRate:i===0?0:rate,mutationStrength:strength}):
      new OccupantBrain({id:"occupant-"+(i+1)}));
  }
  const api=Object.freeze({version:VERSION,inputCount:INPUTS,outputCount:OUTPUTS,hiddenLayers:HIDDEN_LAYERS.slice(),
    inputNames:INPUT_NAMES.slice(),outputNames:OUTPUT_NAMES.slice(),memoryCapacity:MEMORY_CAPACITY,
    episodeCapacity:EPISODE_CAPACITY,rolloutSize:ROLLOUT_SIZE,NeuralNetwork,OccupantBrain,
    ExperienceMemory,EpisodicMemory,normalizePerception,shouldJump,createPopulation,
    AgentLearning:Object.freeze({sampleAction,trainPPO})});
  root.FrameLabs3AgentFive=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
