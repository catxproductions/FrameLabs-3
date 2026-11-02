#include <cuda_runtime.h>

#include "framelabs/sim/SimulationCuda.h"

namespace framelabs {

__global__ void simulationKernel(float* positions, float* velocities, std::size_t count, float dt, float damping) {
  const std::size_t idx = blockIdx.x * blockDim.x + threadIdx.x;
  if (idx >= count) {
    return;
  }

  positions[idx] += velocities[idx] * dt * 2.0f;
  velocities[idx] = velocities[idx] * damping;

  if (positions[idx] > 100.0f) {
    positions[idx] = -100.0f;
  }
  if (positions[idx] < -100.0f) {
    positions[idx] = 100.0f;
  }
}

void cudaStepSimulation(float* positions, float* velocities, std::size_t count, float dt, float damping) {
  if (positions == nullptr || velocities == nullptr || count == 0) {
    return;
  }

  const int threadsPerBlock = 256;
  const int blocks = static_cast<int>((count + threadsPerBlock - 1) / threadsPerBlock);
  simulationKernel<<<blocks, threadsPerBlock>>>(positions, velocities, count, dt, damping);
  cudaDeviceSynchronize();
}

}  // namespace framelabs
