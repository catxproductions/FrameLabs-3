#include <iostream>

#include "framelabs/sim/SimulationEngine.h"
#include "framelabs/sim/World.h"

int main() {
  framelabs::SimulationConfig config;
  config.particleCount = 131072;
  config.enableGpu = true;
  config.enableCpu = true;
  config.profileName = "balanced";

  framelabs::SimulationEngine engine(config);
  engine.initialize();

  const auto worldEntityCount = engine.world().createEntity("world-anchor");
  framelabs::TransformComponent transform{0.0f, 0.0f, 0.0f, 0.0f, 0.15f, 0.0f};
  framelabs::PhysicsComponent physics{4.5f, 0.09f};
  framelabs::RenderComponent render{"world.mesh", 2.0f};

  engine.world().addComponent(worldEntityCount, transform);
  engine.world().addComponent(worldEntityCount, physics);
  engine.world().addComponent(worldEntityCount, render);

  for (int i = 0; i < 60; ++i) {
    engine.step(1.0f / 60.0f);
  }

  std::cout << "Simulation completed with average frame time: "
            << engine.profiler().averageFrameMs() << " ms\n";
  std::cout << "Simulation completed with FPS: "
            << engine.profiler().fps() << "\n";
  std::cout << "Average engine latency: " << engine.latencyMs() << " ms\n";

  return 0;
}
