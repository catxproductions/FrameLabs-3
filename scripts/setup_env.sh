#!/usr/bin/env bash
set -euo pipefail

FRAMELABS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FRAMELABS_ROOT

if command -v nvcc >/dev/null 2>&1; then
  export CUDA_HOME="$(dirname "$(dirname "$(command -v nvcc)")")"
  export PATH="$CUDA_HOME/bin:$PATH"
  export LD_LIBRARY_PATH="$CUDA_HOME/lib64:${LD_LIBRARY_PATH:-}"
  echo "[FrameLabs] CUDA toolchain detected at $CUDA_HOME"
else
  echo "[FrameLabs] CUDA toolchain not detected; falling back to CPU-only build."
fi

if command -v cmake >/dev/null 2>&1; then
  echo "[FrameLabs] Configuring project with CMake..."
  cmake -S "$FRAMELABS_ROOT" -B "$FRAMELABS_ROOT/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DFRAME_ENABLE_CUDA=ON
else
  echo "[FrameLabs] CMake is required but was not found in PATH." >&2
  exit 1
fi

echo "[FrameLabs] Environment setup complete. Run: cmake --build $FRAMELABS_ROOT/build --parallel"
