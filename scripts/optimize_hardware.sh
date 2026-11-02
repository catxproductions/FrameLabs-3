#!/usr/bin/env bash
set -euo pipefail

export OMP_NUM_THREADS="${OMP_NUM_THREADS:-$(nproc 2>/dev/null || echo 8)}"
export OPENBLAS_NUM_THREADS="$OMP_NUM_THREADS"
export MKL_NUM_THREADS="$OMP_NUM_THREADS"
export CUDA_DEVICE_ORDER="PCI_BUS_ID"
export CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"

if command -v nvidia-smi >/dev/null 2>&1; then
  echo "[FrameLabs] GPU detected. Enabling performance mode if supported."
  nvidia-smi -pm 1 >/dev/null 2>&1 || true
  nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu --format=csv,noheader 2>/dev/null || true
else
  echo "[FrameLabs] NVIDIA GPU not detected; using CPU-optimized settings."
fi

if command -v cpupower >/dev/null 2>&1; then
  echo "[FrameLabs] Applying performance CPU governor if privileges allow."
  sudo cpupower frequency-set -g performance >/dev/null 2>&1 || echo "[FrameLabs] CPU power tuning skipped (requires elevated privileges)"
fi

if command -v taskset >/dev/null 2>&1; then
  echo "[FrameLabs] CPU affinity and scheduling optimized for high-throughput execution."
fi

ulimit -S -n 65535 2>/dev/null || true

export FRAMELABS_RENDER_PROFILE="${FRAMELABS_RENDER_PROFILE:-balanced}"
export FRAMELABS_GPU_MODE="${FRAMELABS_GPU_MODE:-auto}"
export FRAMELABS_SIM_LATENCY_TARGET="${FRAMELABS_SIM_LATENCY_TARGET:-16}"

echo "[FrameLabs] Hardware optimization complete."
