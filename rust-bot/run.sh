#!/usr/bin/env bash
set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  echo "[RustBot] cargo not found. Install Rust first: sudo dnf install -y rust cargo" >&2
  exit 1
fi

if command -v rustup >/dev/null 2>&1; then
  rustup toolchain install nightly >/dev/null 2>&1 || true
  rustup default nightly >/dev/null 2>&1 || true
fi

cd "$(dirname "$0")"

cargo run --release -- "$@"
