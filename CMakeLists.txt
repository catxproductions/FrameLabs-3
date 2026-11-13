cmake_minimum_required(VERSION 3.24)

project(FrameLabs3 VERSION 0.2.0 LANGUAGES C CXX)

include(FetchContent)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Build dependencies statically for a self-contained first Windows executable.
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static dependencies" FORCE)

# raylib: native windowing, input, and hardware-accelerated viewport rendering.
set(BUILD_EXAMPLES OFF CACHE BOOL "Do not build raylib examples" FORCE)
set(CUSTOMIZE_BUILD OFF CACHE BOOL "Use raylib defaults" FORCE)
FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 6.2
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(raylib)

# Jolt: multithreaded rigid-body simulation. Pin its source revision so builds
# remain reproducible while upstream development continues.
set(USE_ASSERTS ON CACHE BOOL "Enable Jolt assertions in Debug builds" FORCE)
set(INTERPROCEDURAL_OPTIMIZATION OFF CACHE BOOL "Keep dependency builds predictable" FORCE)
set(JPH_BUILD_SHARED_LIBS OFF CACHE BOOL "Build Jolt statically" FORCE)
set(JPH_USE_DX12 OFF CACHE BOOL "Defer DirectX compute backend" FORCE)
set(JPH_USE_VK OFF CACHE BOOL "Defer Vulkan compute backend" FORCE)
set(JPH_USE_MTL OFF CACHE BOOL "Defer Metal compute backend" FORCE)
set(JPH_USE_CPU_COMPUTE ON CACHE BOOL "Keep CPU compute support enabled" FORCE)
set(ENABLE_INSTALL OFF CACHE BOOL "Do not install Jolt from this project" FORCE)
FetchContent_Declare(
    JoltPhysics
    GIT_REPOSITORY https://github.com/jrouwe/JoltPhysics.git
    GIT_TAG 776666eb232767d5e5b07b6f43cd820f5bf7161c
    SOURCE_SUBDIR Build
)
FetchContent_MakeAvailable(JoltPhysics)

add_executable(FrameLabs3
    native/src/main.cpp
    native/src/PhysicsWorld.cpp
)

target_include_directories(FrameLabs3 PRIVATE native/include)
target_link_libraries(FrameLabs3 PRIVATE raylib Jolt)
target_compile_definitions(FrameLabs3 PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN)

if(MSVC)
    target_compile_options(FrameLabs3 PRIVATE /W4 /permissive- /utf-8)
else()
    target_compile_options(FrameLabs3 PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Keep multi-configuration Windows builds in one predictable folder for CI.
foreach(configuration Debug Release RelWithDebInfo MinSizeRel)
    set_target_properties(FrameLabs3 PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY_\${configuration} "\${CMAKE_BINARY_DIR}/bin"
    )
endforeach()
set_target_properties(FrameLabs3 PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "\${CMAKE_BINARY_DIR}/bin"
)

message(STATUS "FrameLabs 3 native sandbox configured.")
message(STATUS "Physics: Jolt Physics (multithreaded CPU rigid bodies)")
message(STATUS "Viewport: raylib 6.2 (native OpenGL rendering)")
