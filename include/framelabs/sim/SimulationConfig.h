#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace framelabs {

struct SimulationConfig {
  std::size_t particleCount = 65536;
  std::size_t workerThreads = 8;
  std::size_t gpuBlockSize = 256;
  float damping = 0.97f;
  float gravity = 9.81f;
  float worldScale = 1.0f;
  bool enableGpu = true;
  bool enableCpu = true;
  bool usePinnedMemory = true;
  std::string profileName = "balanced";
};

}  // namespace framelabs
