#include <chrono>
#include <iostream>
#include <vector>

#include "framelabs/sim/SimulationCpu.h"
#include "framelabs/sim/SimulationCuda.h"
#include "framelabs/sim/SimulationEngine.h"

namespace framelabs {

SimulationEngine::SimulationEngine(const SimulationConfig& config)
    : config_(config),
      positions_(config_.particleCount * 3, 0.0f),
      velocities_(config_.particleCount * 3, 0.0f) {
}

SimulationEngine::~SimulationEngine() = default;

void SimulationEngine::initialize() {
  for (std::size_t i = 0; i < positions_.size(); ++i) {
    positions_[i] = static_cast<float>(i % 17) * 0.25f;
    velocities_[i] = (i % 7) * 0.01f;
  }
}

void SimulationEngine::step(float dt) {
  auto start = std::chrono::steady_clock::now();

  if (config_.enableGpu && config_.enableCpu) {
#if FRAME_ENABLE_CUDA
    cudaStepSimulation(positions_.data(), velocities_.data(), positions_.size(), dt, config_.damping);
#else
    cpuStepSimulation(positions_.data(), velocities_.data(), positions_.size(), dt, config_.damping);
#endif
  } else if (config_.enableGpu) {
#if FRAME_ENABLE_CUDA
    cudaStepSimulation(positions_.data(), velocities_.data(), positions_.size(), dt, config_.damping);
#endif
  } else {
    cpuStepSimulation(positions_.data(), velocities_.data(), positions_.size(), dt, config_.damping);
  }

  const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::steady_clock::now() - start);
  latencyMs_ = static_cast<std::uint64_t>(elapsed.count() / 1000ULL);
}

std::vector<float> SimulationEngine::simulateFrame(float dt) {
  step(dt);
  return positions_;
}

const SimulationConfig& SimulationEngine::config() const noexcept {
  return config_;
}

std::uint64_t SimulationEngine::latencyMs() const noexcept {
  return latencyMs_;
}

}  // namespace framelabs
