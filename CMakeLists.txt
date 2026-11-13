cmake_minimum_required(VERSION 3.24)
project(FrameLabs3 VERSION 0.4.0 LANGUAGES C CXX)

include(FetchContent)
set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# The player receives one self-contained executable. raylib is fetched by
# the build runner and statically linked into the final application.
if(MSVC)
  cmake_policy(SET CMP0091 NEW)
  set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build static dependencies" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(CUSTOMIZE_BUILD OFF CACHE BOOL "" FORCE)
FetchContent_Declare(raylib
  GIT_REPOSITORY https://github.com/raysan5/raylib.git
  GIT_TAG 6.2
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(raylib)

add_executable(FrameLabs3 WIN32
  native/src/main.cpp
  native/src/StructuralWorld.cpp
)
target_include_directories(FrameLabs3 PRIVATE native/include)
target_link_libraries(FrameLabs3 PRIVATE raylib)
target_compile_definitions(FrameLabs3 PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN)
if(MSVC)
  target_compile_options(FrameLabs3 PRIVATE /W4 /permissive- /utf-8 /EHsc)
else()
  target_compile_options(FrameLabs3 PRIVATE -Wall -Wextra -Wpedantic)
endif()
set_target_properties(FrameLabs3 PROPERTIES
  OUTPUT_NAME "FrameLabs3"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_BINARY_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_BINARY_DIR}/bin"
)
message(STATUS "FrameLabs 3: native 2D structural physics / static Windows executable")
