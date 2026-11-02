cmake_minimum_required(VERSION 3.18)

project(FrameLabs3Simulation VERSION 1.0.0 LANGUAGES CXX)

option(FRAME_ENABLE_CUDA "Enable CUDA accelerated simulation backend" ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(FRAME_SIM_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/include")

if(FRAME_ENABLE_CUDA)
  find_package(CUDAToolkit QUIET)
  if(CUDAToolkit_FOUND)
    enable_language(CUDA)
    set(FRAME_HAS_CUDA TRUE)
  else()
    message(WARNING "CUDA Toolkit not found. Building CPU-only simulation backend.")
    set(FRAME_HAS_CUDA FALSE)
  endif()
else()
  set(FRAME_HAS_CUDA FALSE)
endif()

add_library(framelabs_sim
  src/SimulationEngine.cpp
  src/SimulationCpu.cpp
  src/FrameProfiler.cpp
  src/GpuMemoryPool.cpp
  src/World.cpp
)

target_include_directories(framelabs_sim
  PUBLIC
    ${FRAME_SIM_INCLUDE_DIR}
)

target_compile_features(framelabs_sim PUBLIC cxx_std_17)

if(FRAME_HAS_CUDA)
  target_sources(framelabs_sim PRIVATE src/SimulationCuda.cu)
  target_compile_definitions(framelabs_sim PUBLIC FRAME_ENABLE_CUDA=1)
  target_link_libraries(framelabs_sim PUBLIC CUDA::cudart)
else()
  target_compile_definitions(framelabs_sim PUBLIC FRAME_ENABLE_CUDA=0)
endif()

add_executable(framelabs_simulator src/main.cpp)
target_link_libraries(framelabs_simulator PRIVATE framelabs_sim)

set_target_properties(framelabs_sim PROPERTIES
  CXX_STANDARD 17
  CXX_STANDARD_REQUIRED YES
)

if(FRAME_HAS_CUDA)
  set_target_properties(framelabs_sim PROPERTIES
    CUDA_STANDARD 17
    CUDA_STANDARD_REQUIRED YES
  )
endif()

message(STATUS "FrameLabs 3 simulation backend configured.")
message(STATUS "CUDA backend: ${FRAME_HAS_CUDA}")
