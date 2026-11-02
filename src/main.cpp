#include <iostream>

#include "framelabs/sim/SimulationEngine.h"

int main() {
  framelabs::SimulationConfig config;
  config.particleCount = 131072;
  config.enableGpu = true;
  config.enableCpu = true;
  config.profileName = "balanced";

  framelabs::SimulationEngine engine(config);
  engine.initialize();

  for (int i = 0; i < 60; ++i) {
    engine.step(1.0f / 60.0f);
  }

  std::cout << "Simulation completed with average latency: "
            << engine.latencyMs() << " ms\n";

  return 0;
}
