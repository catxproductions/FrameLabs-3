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
| Connect members + click two nodes | Create a structural member |
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
