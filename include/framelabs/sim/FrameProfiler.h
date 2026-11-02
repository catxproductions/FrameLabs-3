#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <unordered_map>
#include <vector>

namespace framelabs {

struct FrameSample {
  double frameMs = 0.0;
  double fps = 0.0;
};

class FrameProfiler {
 public:
  void beginFrame();
  void endFrame();

  double averageFrameMs() const noexcept;
  double worstFrameMs() const noexcept;
  double fps() const noexcept;
  std::size_t frameCount() const noexcept;

 private:
  std::chrono::steady_clock::time_point frameStart_;
  std::vector<double> frameSamples_;
  double accumulatedMs_ = 0.0;
  double worstFrameMs_ = 0.0;
  std::size_t frameCount_ = 0;
};

}  // namespace framelabs
