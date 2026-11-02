#pragma once

#include <vector>

#include "framelabs/sim/SimulationConfig.h"

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

 private:
  SimulationConfig config_;
  std::vector<float> positions_;
  std::vector<float> velocities_;
  std::uint64_t latencyMs_ = 0;
};

}  // namespace framelabs
