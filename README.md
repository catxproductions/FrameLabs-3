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
- Structural member failure: failed members lose their constraints and their pieces continue moving as debris.
- Material selection for steel, wood, composite, and concrete.
- Stress visualization, selection, pause, reset, zoom, and viewport panning.
- Localized heat brush that raises member temperature and changes material response.

### Physical grid scale

One grid cell represents **5 square feet of area**. Each cell is therefore approximately **2.236 ft × 2.236 ft** (0.6816 m per side). The native and browser-preview solvers convert gravity, member mass, and load mass using this scale. Loads labelled in kilograms are treated as kilograms rather than scaled-down display values.

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

**Current integration boundary:** the script is loaded by the browser preview and exposes `window.FrameLabs3AgentFive`. The native C++ executable does not yet call this JavaScript module, and the browser simulation does not yet create floor-based occupants or connect their actions to the structural solver. Those are subsequent integration tasks.


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

Navigation links and exits are saved in the build snapshot and restored by Reset Structure. Select Delete and click a connector or exit to remove it. The navigation graph connects same-floor points with walking edges and different-floor stops through ladders, stairs, or elevators. Its route planner selects a reachable exit using weighted path costs.

### Agent Five navigation adapter

The browser exposes `window.FrameLabs3Navigation`:

- `findRouteToExit(x, y)` returns the nearest reachable exit, route cost, floor difference, direction, and route points.
- `getOccupantPerception(x, y, extras)` creates the FL3 Agent Five perception object, including floor/exit distances, smoke density, fire intensity, and debris clearance.

This provides the navigation and perception interface for the FL3 Agent Five occupant brain. This implementation adds the building connectors, exits, route graph, and perception adapter; it does **not** yet spawn or run an occupant population in the structural scene. The native C++ executable is also still a separate implementation and does not yet consume these browser JavaScript systems.
