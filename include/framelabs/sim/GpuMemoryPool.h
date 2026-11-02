#pragma once

#include <cstddef>
#include <cstdint>
#include <vector>

namespace framelabs {

class GpuMemoryPool {
 public:
  explicit GpuMemoryPool(std::size_t capacityBytes = 4 * 1024 * 1024);
  ~GpuMemoryPool();

  void* allocate(std::size_t bytes);
  void release(void* ptr);
  void upload(const void* hostData, void* deviceData, std::size_t bytes) const;
  std::size_t capacity() const noexcept;

 private:
  std::size_t capacityBytes_ = 0;
  std::vector<std::uint8_t> hostBuffer_;

#if FRAME_ENABLE_CUDA
  void* deviceBuffer_ = nullptr;
  void* pinnedBuffer_ = nullptr;
#endif
};

}  // namespace framelabs
