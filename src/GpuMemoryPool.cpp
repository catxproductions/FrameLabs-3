#include <cstring>
#include <new>

#include "framelabs/sim/GpuMemoryPool.h"

namespace framelabs {

GpuMemoryPool::GpuMemoryPool(std::size_t capacityBytes)
    : capacityBytes_(capacityBytes), hostBuffer_(capacityBytes ? capacityBytes : 1) {
#if FRAME_ENABLE_CUDA
  if (capacityBytes_ == 0) {
    return;
  }

  if (cudaMalloc(&deviceBuffer_, capacityBytes_) != cudaSuccess) {
    deviceBuffer_ = nullptr;
  }

  if (cudaMallocHost(&pinnedBuffer_, capacityBytes_) != cudaSuccess) {
    pinnedBuffer_ = nullptr;
  }
#endif
}

GpuMemoryPool::~GpuMemoryPool() {
#if FRAME_ENABLE_CUDA
  if (deviceBuffer_ != nullptr) {
    cudaFree(deviceBuffer_);
  }
  if (pinnedBuffer_ != nullptr) {
    cudaFreeHost(pinnedBuffer_);
  }
#endif
}

void* GpuMemoryPool::allocate(std::size_t bytes) {
  if (bytes == 0) {
    return nullptr;
  }

#if FRAME_ENABLE_CUDA
  if (deviceBuffer_ == nullptr) {
    return nullptr;
  }
  return deviceBuffer_;
#else
  if (hostBuffer_.size() < bytes) {
    hostBuffer_.resize(bytes);
  }
  return hostBuffer_.data();
#endif
}

void GpuMemoryPool::release(void* ptr) {
  (void)ptr;
}

void GpuMemoryPool::upload(const void* hostData, void* deviceData, std::size_t bytes) const {
#if FRAME_ENABLE_CUDA
  if (hostData == nullptr || deviceData == nullptr || bytes == 0) {
    return;
  }
  cudaMemcpy(deviceData, hostData, bytes, cudaMemcpyHostToDevice);
#else
  if (hostData == nullptr || deviceData == nullptr || bytes == 0) {
    return;
  }
  std::memcpy(deviceData, hostData, bytes);
#endif
}

std::size_t GpuMemoryPool::capacity() const noexcept {
  return capacityBytes_;
}

}  // namespace framelabs
