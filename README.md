# FrameLabs 3 — Structural Lab

FrameLabs 3 is a ground-up 2D structural-stress and physics game. It takes the core identity of FrameLabs 2—constructing structures, loading them, watching forces travel through members, and seeing failures propagate—and rebuilds the experience around a native desktop engine.

## Design direction

FL3 is **not** a 3D block sandbox. The game world is two-dimensional and structures are connected systems of nodes and members. The goal is to make structural behaviour readable, physical, interactive, and dramatically more expressive than the previous game.

### Current native foundation

- Native Windows application with a 2D structural workspace.
- Node-based construction: place nodes and connect them into beams, columns, braces, and larger frames.
- Pinned supports: right-click a node to pin or release it.
- Dynamic test loads that apply weight to structures.
- Member deformation using subdivided particles and position-based constraints.
- Structural member failure: failed members lose their constraints, continue moving as debris, and collide with intact members and other debris.
- Separate native Break and Delete tools: Break releases moving fragments; Delete removes a member without leaving debris.
- Material selection for steel, wood, composite, explosive composite, flammable composite, and concrete.
- Stress visualization, selection, pause, reset, zoom, and viewport panning.
- Localized heat brush, ignition, explosion impulses, and native dust, sparks, flame, and smoke particles.
- Quick Build beam/column/brace tools, Floor and Wall construction tools, exit markers, and named native build saves.
- Structural navigation assemblies: ladders, stairs, and elevator shafts attach to supporting nodes or member segments, follow their motion, and become gravity-driven rigid falling assemblies when their support fails.

### Physical grid scale

One grid cell represents **25 ft × 25 ft** (**625 square feet**). The native and browser-preview solvers convert gravity, member mass, and load mass using this physical world scale. Loads labelled in kilograms are treated as kilograms rather than scaled-down display values.

The material and failure models remain game-tuned approximations, not certified structural-engineering calculations. The grid scale gives the simulation a consistent physical reference; it does not make the solver suitable for real building design.

### Heated metal and tensile failure

Steel expands as it heats, loses axial stiffness and tensile strength, and can accumulate permanent elongation when it is pulled beyond its temperature-dependent yield point. The solver records peak tensile strain before constraint correction, so an overloaded member cannot hide its stress merely because the solver pulls it back toward its rest length. Sustained overload accumulates fatigue and can fracture the member. These are deliberately exaggerated game responses, not engineering-grade material predictions.

### Ropes

The Rope tool creates flexible, sagging members. Rope constraints are **tension-only**: they pull when stretched, go slack when compressed, and do not apply beam-style bending rigidity. Use the selected material to choose the rope's density and failure response.

### Material behaviour

The first material response model is deliberately game-tuned rather than presented as certified engineering analysis:

| Material | Bending behaviour | Failure behaviour |
|---|---|---|
| Steel | Most visible elastic bending before failure | Bends substantially, then snaps |
| Wood | Slight elastic bending | Snaps after a smaller bend |
| Composite | Very little elastic bending | Brittle failure after minimal bend |
| Concrete | Very stiff, limited deformation | Cracks/fails at low deformation |

Heat raises member temperature, reduces effective bending stiffness, and lowers the strain/bend threshold for failure. The exact response is tuned per material rather than applying one generic heat multiplier to everything.

These are stylized game units. They are not structural engineering measurements or safe design recommendations.

## Quick Build

Frame Mode includes three drag-to-place structural tools:

- **Beam (B):** places a horizontal member.
- **Column (C):** places a vertical member.
- **Brace (D):** places a diagonal member aligned to 45 degrees.

Drag from an existing node or an open point to the destination. Nearby compatible nodes are reused, and new endpoints are added to the structure automatically. The member uses the currently selected material and participates in the same physics, collision, stress, and failure systems as other structural members. The native Windows toolbox now includes drag-to-place Beam, Column, and Brace tools with axis/45-degree alignment.

## Saved builds (browser preview)

The browser preview includes a local build library. **Save Build** stores a named snapshot in the current browser, including nodes, member geometry and materials, test loads, ladders/stairs/elevators, exits, and build preferences. **Saved Builds** lets you load or delete a saved structure and export it as a portable `.fl3build.json` file. Exported builds can be imported in another browser using **Import .JSON**.

The native Windows edition now has **Save Build** and **Load Latest** in its top toolbar. It stores named `.fl3build` snapshots under the current Windows user's `FrameLabs 3/Saved Builds` folder. Native saves include nodes, intact member types/materials, loads, connectors, and exit markers. The current native loader restores the most recently saved native build; browser JSON import/export and cross-edition conversion are still to be added.

Browser saves stay in that browser and native saves stay in the Windows user folder. They do not automatically sync between devices.

## Building modes

- **Frame Mode** preserves the existing frame construction tools.
- **Floor Mode** adds Floor and Wall panel tools. In the browser, drag from one intact structural member to another; floors snap level and walls snap vertical.
- The native Windows edition includes Floor and Wall tools that use two frame support nodes, create level/plumb panel members, and add a connecting support member.
- Panels are physical structural members that use the selected material and participate in deformation, contact, mass, and load transfer.

## Controls

| Input | Action |
|---|---|
| Select tool + left click | Select a node or member |
| Add node tool + left click | Place a node |
| Connect tool + click two nodes | Create a rigid structural member |
| Rope tool (T) + click two nodes | Create a flexible tension-only rope |
| Add load tool + left click | Place a 220 kg test load |
| Heat brush + hold left click | Heat nearby members |
| Right click a node | Pin / unpin support |
| Middle mouse drag | Pan the viewport |
| Mouse wheel | Zoom |
| 1–5 | Select the corresponding tool |
| B / C / D | Quick Build beam / column / brace (native and browser) |
| F / W | Floor / Wall tool |
| K | Break selected member under cursor |
| Save Build / Load Latest | Native build library toolbar actions |
| Space | Pause / resume |
| R | Reset the starter experiment |

## Build the Windows game

Players will not need a shell, package manager, compiler, or separate runtime installation. The intended release is a single FrameLabs3.exe.

The GitHub Actions build runner fetches raylib, compiles the game, and statically links the library and MSVC runtime. Those build-time steps happen on GitHub's runner, not on the player's computer.

For contributors, the automated workflow is Windows Desktop Build. It uploads the compiled executable as a workflow artifact after verifying that the file exists.

## Important scope notes

This is the first playable structural-engine foundation, not the finished FL3 feature set. The current solver is a custom 2D position-based structural model. It is not yet a calibrated finite-element solver and it does not claim to calculate real-world safe loads.

Planned engine milestones include:
1. Better bending and shear mechanics, with stable beam cross-sections and member-local stress.
2. Robust contact and collision between detached structural pieces.
3. More complete support/load paths and force visualization.
4. Material fatigue, heat propagation, fire, and environmental effects.
5. Save/load, construction tools, scenario systems, and polished tutorials.
6. Performance profiling and safe parallelization of independent simulation work.

The FL2 codebase is used as a design reference for material distinctions, heat weakening, structural failure, and game feel. FL3's engine is being built as a separate native 2D implementation rather than porting FL2's browser runtime wholesale.


## Agent Five occupant intelligence (FL3 adaptation)

FL3 includes an FL3-owned adaptation of the Agent Five neural architecture in `agent-five-fl3.js`. It preserves Agent Five v8's 16-input, 26-hidden-layer fully connected tanh topology, separate value critic, PPO-style policy optimization with generalized advantage estimation, and prioritized/episodic experience memory. The FL3 actor head has four outputs instead of Agent Five's original three.

### Perception inputs (in fixed order)

1. Distance from floor
2. Current floor
3. Distance from wall
4. Temperature
5. Falling speed
6. Distance from falling object
7. Panic
8. Horizontal speed
9. Distance from exit
10. Exit direction
11. Floor difference to exit
12. Smoke density
13. Fire intensity
14. Structural danger
15. Nearby occupant density
16. Debris clearance

Object observations are normalized to [-1, 1]. Sensor scales can be overridden per observation using its `scale` object. Distance sensors encode close as -1 and far as +1; hazard intensity encodes none as -1 and maximum as +1.

### Actor outputs

- `thrustLeft`: independent left thrust, 0–1.
- `thrustRight`: independent right thrust, 0–1.
- `brake`: braking / friction control, 0–1.
- `jump`: jump request, 0–1. FL3 should trigger a jump only when the value is at least 0.5, the occupant is grounded, and its jump cooldown is ready.

The network returns decisions; the FL3 physics/navigation layer must apply those controls and build each occupant's sensor observation. The neural module does not invent floor geometry, exits, collision forces, smoke transport, or agent body physics.

### Example adapter use

```js
const population = FrameLabs3AgentFive.createPopulation(24);
const occupant = population[0];

const decision = occupant.decide(perception, deltaSeconds);
if (!decision.disabled) {
  applyOccupantControls(decision.controls);
  const jump = FrameLabs3AgentFive.shouldJump(
    decision.controls, body.grounded, body.jumpCooldown <= 0
  );
  if (jump) requestOccupantJump(body);
}

// Report normalized force ratios from the physics solver.
// A ratio >= 1 means that solver's configured disable threshold was reached.
occupant.reportPhysicalStress({
  landingImpact: landingSeverityRatio,
  stampedeImpact: crowdImpactSeverityRatio,
  impactForce: impactSeverityRatio,
  crushForce: crushSeverityRatio
});

// Give feedback after each action. Mark the final experience terminal.
occupant.recordOutcome(reward, "hazard-avoidance", { terminal: episodeEnded });
```

A panic value of 1.0 (100%) disables the occupant. The physics layer can also disable an occupant when landing impact, stampede impact, impact force, or crush-force severity reaches 1.0. These values are normalized ratios supplied by FL3; the host physics system owns the actual game thresholds.

**Training compatibility:** FL3 uses a fresh FL3-specific model because the meanings of its 16 inputs and four actions differ from Agent Five's original environment. The original project's protected trained model parameters are not copied. Each FL3 brain learns through its own PPO rollouts and experience; population descendants can inherit and mutate a parent brain using `createPopulation(size, { parent })`.

**Browser-preview integration:** `occupant-simulation.js` connects this neural module to the multi-floor navigation graph. Start a structural test, place at least one exit before starting the test, then use **Spawn 12** in the occupant population panel. Each occupant receives an independent brain, perception state, memory, and PPO training history. The navigation graph supplies a stable route prior; Agent Five controls steering variation and braking. Occupants are affected by gravity and can stand on intact, approximately horizontal structural members; breaking a support causes them to fall to the next available surface or ground. The neural jump output is intentionally gated off by default until the host simulation provides a validated jump opportunity and collision support. The adapter computes local smoke, fire, debris, structural-danger, wall-distance, and crowd-density observations, then reports route progress and successful exits as learning feedback. Population simulation is stepped only while the structural test is running; reset and clear operations also clear the active population.

The occupant runtime is deliberately lightweight: occupants are abstract simulation agents, not individually deformable rigid bodies. The browser preview owns their movement and rendering, while the neural network owns action selection and the world-systems module owns navigation and environmental observations. The native C++ executable now has its own structural connector physics and native stair/ladder/elevator tools. Browser Agent Five population remains a browser-preview feature and is not yet integrated into the native C++ executable.


## Structural destruction, effects, and building navigation

The browser simulation loads `world-systems.js` before `app.js`. When a structural member fails or the Break tool is used, the original constraint member is detached from the structural solver and released as two independent rigid debris fragments. Fragments inherit their current translational and rotational motion, collide with the ground, other fragments, nearby standing members, and test loads, then settle into rubble. A bounded debris count prevents unbounded growth during long tests.

Fractures emit localized dust and material-dependent sparks or splinters. The effects system also supports smoke and flame particles. Wood, explosive composite, and flammable composite have combustion properties; burning members heat up, weaken through the existing thermal material model, transfer heat to nearby members, and emit smoke. Explosive composite can trigger an in-game radial impulse once its ignition temperature is reached. Particles are visual approximations; structural temperatures, member failure, and detached debris are separate simulation state.

### Navigation tools

| Tool | Placement | Navigation behavior |
|---|---|---|
| Ladder | Click two floor landings | Adds a climb connection with a slower traversal cost |
| Stairs | Click two floor landings | Adds a walkable inclined floor connection |
| Elevator | Click two floor stops | Adds a lift connection with a small wait-cost |
| Exit | Click a floor edge | Marks a safe destination |

Navigation links and exits are saved in the build snapshot and restored by Reset Structure. Select Delete and click a connector or exit to remove it. When a stair, ladder, or elevator landing is placed on a structural node or member, its endpoints attach to that geometry and move with the structure. If an attachment fails or the two landings separate beyond the connector's allowed deformation, the complete assembly is released as a falling rigid connector; falling connectors no longer appear as usable evacuation routes. Falling stairs and elevator shafts respond to gravity and can land on the ground or an intact horizontal structural member. The navigation graph connects same-floor points with walking edges and different-floor stops through supported ladders, stairs, or elevators. Its route planner selects a reachable exit using weighted path costs.

### Native structural connector physics

The Windows edition includes native ladder, stairs, and elevator tools. Place each connector by clicking two landing points on structural nodes or non-rope member segments. The connector endpoints bind to those supports and update as the attached structure moves. If an attachment disappears or the landings separate beyond the connector's permitted deformation, the assembly is released with inherited linear/angular motion and falls under native gravity. Falling connectors collide with the ground and intact horizontal structural members. The elevator shaft is rendered using the same rigid transform as its falling physics body.

Use **Ladder**, **Stairs**, or **Elevator** from the Windows toolbox (keyboard shortcuts: L, S, and V). Each connector requires two landing clicks. A connector placed without valid support geometry releases into free fall when the simulation starts.

### Occupant impact and crush response

Browser-preview occupants now accumulate physical injury from hard landings, moving structural members, falling debris, and sustained rubble loads. Fall impact is based on landing speed and drop distance; debris/member impacts use mass and relative speed; settled debris contributes ongoing crush load. Moderate impacts reduce health and movement speed, while severe impacts or accumulated crush load incapacitate the agent. Incapacitated occupants stop AI movement but continue to obey gravity. The population status reports injured and inactive counts, and the renderer marks injured occupants without graphic injury effects.

### Agent Five navigation adapter

The browser exposes `window.FrameLabs3Navigation`:

- `findRouteToExit(x, y)` returns the nearest reachable exit, route cost, floor difference, direction, and route points.
- `getOccupantPerception(x, y, extras)` creates the FL3 Agent Five perception object, including floor/exit distances, smoke density, fire intensity, and debris clearance.

This provides the navigation and perception interface used by the FL3 Agent Five occupant runtime. The browser preview can spawn occupants across detected floor levels and route them through connectors to a reachable exit. The native C++ executable is still a separate implementation and does not yet consume these browser JavaScript systems.
