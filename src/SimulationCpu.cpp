#include <algorithm>
#include <cmath>

#include "framelabs/sim/SimulationCpu.h"

namespace framelabs {

void cpuStepSimulation(float* positions, float* velocities, std::size_t count, float dt, float damping) {
  if (positions == nullptr || velocities == nullptr || count == 0) {
    return;
  }

  constexpr float gravityScale = 9.81f;

  for (std::size_t i = 0; i < count; ++i) {
    const float vel = velocities[i];
    positions[i] += vel * dt; 

    velocities[i] = vel * damping;
    if (std::fmod(static_cast<float>(i), 7.0f) == 0.0f) {
      velocities[i] -= gravityScale * dt * 0.05f;
    }

    if (positions[i] > 100.0f) {
      positions[i] = -100.0f;
    }
    if (positions[i] < -100.0f) {
      positions[i] = 100.0f;
    }
  }
}

}  // namespace framelabs
