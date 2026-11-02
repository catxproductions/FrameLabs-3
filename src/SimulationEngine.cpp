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
      velocities_(config_.particleCount * 3, 0.0f),
      gpuMemoryPool_(std::make_unique<GpuMemoryPool>(config_.particleCount * 3 * sizeof(float) * 2)) {
  initialize();
}

SimulationEngine::~SimulationEngine() = default;

void SimulationEngine::initialize() {
  world_.clear();

  for (std::size_t i = 0; i < positions_.size(); ++i) {
    positions_[i] = static_cast<float>(i % 17) * 0.25f;
    velocities_[i] = (i % 7) * 0.01f;
  }

  const EntityId entityA = world_.createEntity("sim-agent-01");
  world_.addComponent(entityA, TransformComponent{0.0f, 0.0f, 0.0f, 0.0f, 0.5f, 0.0f});
  world_.addComponent(entityA, PhysicsComponent{1.0f, 0.18f});
  world_.addComponent(entityA, RenderComponent{"entity.mesh", 1.0f});

  const EntityId entityB = world_.createEntity("sim-agent-02");
  world_.addComponent(entityB, TransformComponent{4.0f, 2.0f, 0.0f, 0.0f, 0.35f, 0.15f});
  world_.addComponent(entityB, PhysicsComponent{2.0f, 0.12f});
  world_.addComponent(entityB, RenderComponent{"entity-alt.mesh", 1.25f});
}

void SimulationEngine::step(float dt) {
  profiler_.beginFrame();

  auto start = std::chrono::steady_clock::now();

  world_.update(dt);

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

  profiler_.endFrame();
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

World& SimulationEngine::world() noexcept {
  return world_;
}

const World& SimulationEngine::world() const noexcept {
  return world_;
}

const FrameProfiler& SimulationEngine::profiler() const noexcept {
  return profiler_;
}

}  // namespace framelabs
