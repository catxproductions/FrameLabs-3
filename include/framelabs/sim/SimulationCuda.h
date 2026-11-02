#pragma once

#include <cstddef>

namespace framelabs {

#if FRAME_ENABLE_CUDA
void cudaStepSimulation(float* positions, float* velocities, std::size_t count, float dt, float damping);
#endif

}  // namespace framelabs
