#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "framelabs/sim/FrameProfiler.h"
#include "framelabs/sim/GpuMemoryPool.h"
#include "framelabs/sim/SimulationConfig.h"
#include "framelabs/sim/World.h"

namespace framelabs {

class SimulationEngine {
 public:
  explicit SimulationEngine(const SimulationConfig& config = SimulationConfig{});
  ~SimulationEngine();

  void initialize();
  void step(float dt);
  std::vector<float> simulateFrame(float dt);

  const SimulationConfig& config() const noexcept;
  std::uint64_t latencyMs() const noexcept;
  World& world() noexcept;
  const World& world() const noexcept;
  const FrameProfiler& profiler() const noexcept;

 private:
  SimulationConfig config_;
  std::vector<float> positions_;
  std::vector<float> velocities_;
  std::uint64_t latencyMs_ = 0;
  World world_;
  FrameProfiler profiler_;
  std::unique_ptr<GpuMemoryPool> gpuMemoryPool_;
};

}  // namespace framelabs
