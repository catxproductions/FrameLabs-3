cmake_minimum_required(VERSION 3.24)

project(FrameLabs3 VERSION 0.3.0 LANGUAGES C CXX)

include(FetchContent)

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# A Windows download should not require the Microsoft VC++ runtime installer.
# Statically link the MSVC runtime into the final executable and dependencies.
if(MSVC)
    cmake_policy(SET CMP0091 NEW)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static dependencies" FORCE)

# raylib supplies the native desktop window, input, and GPU-accelerated 2D drawing.
set(BUILD_EXAMPLES OFF CACHE BOOL "Do not build raylib examples" FORCE)
set(CUSTOMIZE_BUILD OFF CACHE BOOL "Use raylib defaults" FORCE)
FetchContent_Declare(
    raylib
    GIT_REPOSITORY https://github.com/raysan5/raylib.git
    GIT_TAG 6.2
    GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(raylib)

# Box2D 3.x is a genuinely two-dimensional rigid-body solver. Its internal task
# scheduler is enabled through workerCount; no player-side downloads are needed.
set(BOX2D_SAMPLES OFF CACHE BOOL "Do not build Box2D samples" FORCE)
set(BOX2D_BENCHMARKS OFF CACHE BOOL "Do not build Box2D benchmarks" FORCE)
set(BOX2D_DOCS OFF CACHE BOOL "Do not build Box2D docs" FORCE)
set(BOX2D_UNIT_TESTS OFF CACHE BOOL "Do not build Box2D unit tests" FORCE)
set(BOX2D_PROFILE OFF CACHE BOOL "Do not add profiling dependencies" FORCE)
set(BOX2D_VALIDATE ON CACHE BOOL "Keep Box2D validation enabled" FORCE)
FetchContent_Declare(
    box2d
    GIT_REPOSITORY https://github.com/erincatto/box2d.git
    GIT_TAG 178495ba35695aefe9c321e569d2277f06db3b90
    GIT_SHALLOW FALSE
)
FetchContent_MakeAvailable(box2d)

add_executable(FrameLabs3 WIN32
    native/src/main.cpp
    native/src/StructuralWorld.cpp
)

target_include_directories(FrameLabs3 PRIVATE native/include)
target_link_libraries(FrameLabs3 PRIVATE raylib box2d)
target_compile_definitions(FrameLabs3 PRIVATE
    NOMINMAX
    WIN32_LEAN_AND_MEAN
)

if(MSVC)
    target_compile_options(FrameLabs3 PRIVATE /W4 /permissive- /utf-8 /EHsc)
else()
    target_compile_options(FrameLabs3 PRIVATE -Wall -Wextra -Wpedantic)
endif()

set_target_properties(FrameLabs3 PROPERTIES
    OUTPUT_NAME "FrameLabs3"
    RUNTIME_OUTPUT_DIRECTORY "\${CMAKE_BINARY_DIR}/bin"
)

message(STATUS "FrameLabs 3 native 2D structural sandbox configured.")
message(STATUS "Physics: Box2D 3.2 (multithreaded 2D rigid-body simulation)")
message(STATUS "Rendering: raylib 6.2 (native GPU-accelerated 2D renderer)")
message(STATUS "Packaging: static libraries and static MSVC runtime")
