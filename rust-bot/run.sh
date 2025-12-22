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

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure crates are downloaded before patching.
cargo fetch >/dev/null 2>&1 || true

VENDOR_DIR="$SCRIPT_DIR/vendor"
mkdir -p "$VENDOR_DIR"

copy_crate() {
  local name="$1"
  local version="$2"
  local dest="$VENDOR_DIR/$name"
  if [ -d "$dest" ]; then
    return
  fi
  local src
  src=$(ls -d "$HOME/.cargo/registry/src"/*/"${name}-${version}" 2>/dev/null | head -n 1 || true)
  if [ -z "$src" ]; then
    echo "[RustBot] Unable to find ${name}-${version} in cargo registry." >&2
    exit 1
  fi
  cp -R "$src" "$dest"
}

apply_patch() {
  local file="$1"
  local marker="$2"
  if rg -q "$marker" "$file"; then
    return
  fi
  python - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "CryptoGenerator" in text and "Generator" in text and "next_word" in text:
    sys.exit(0)

# Patch chacha20 rng.rs
text = text.replace(
    "use rand_core::{\n    CryptoRng, RngCore, SeedableRng,\n    block::{BlockRng, BlockRngCore, CryptoBlockRng},\n};",
    "use rand_core::{\n    CryptoRng, RngCore, SeedableRng,\n    block::{BlockRng, CryptoGenerator, Generator},\n};",
)
text = text.replace(
    "pub struct BlockRngResults([u32; BUFFER_SIZE]);\n\nimpl AsRef<[u32]> for BlockRngResults {\n    fn as_ref(&self) -> &[u32] {\n        &self.0\n    }\n}\n\nimpl AsMut<[u32]> for BlockRngResults {\n    fn as_mut(&mut self) -> &mut [u32] {\n        &mut self.0\n    }\n}\n\nimpl Default for BlockRngResults {\n    fn default() -> Self {\n        Self([0u32; BUFFER_SIZE])\n    }\n}\n\n#[cfg(feature = \"zeroize\")]\nimpl Drop for BlockRngResults {\n    fn drop(&mut self) {\n        self.0.zeroize();\n    }\n}\n",
    "pub type BlockRngResults = [u32; BUFFER_SIZE];\n",
)
text = text.replace("self.core.next_u32()", "self.core.next_word()")
text = text.replace("self.core.next_u64()", "self.core.next_u64_from_u32()")
text = text.replace("impl CryptoBlockRng for $ChaChaXCore {}", "impl CryptoGenerator for $ChaChaXCore {}")
text = text.replace(
    "impl BlockRngCore for $ChaChaXCore {\n            type Item = u32;\n            type Results = BlockRngResults;\n\n            #[inline]\n            fn generate(&mut self, r: &mut Self::Results) {\n                self.0.generate(&mut r.0);\n            }\n        }",
    "impl Generator for $ChaChaXCore {\n            type Output = BlockRngResults;\n\n            #[inline]\n            fn generate(&mut self, r: &mut Self::Output) {\n                self.0.generate(r);\n            }\n\n            #[cfg(feature = \"zeroize\")]\n            #[inline]\n            fn drop(&mut self, output: &mut Self::Output) {\n                output.zeroize();\n            }\n        }",
)

path.write_text(text)
PY
}

patch_rand() {
  local file="$1"
  python - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "Generator<Output = [u32; 64]>" in text:
    sys.exit(0)

text = text.replace(
    "use rand_core::block::{BlockRng, BlockRngCore, CryptoBlockRng};\nuse rand_core::{CryptoRng, RngCore, SeedableRng, TryCryptoRng, TryRngCore};",
    "use rand_core::block::{BlockRng, CryptoGenerator, Generator};\nuse rand_core::{CryptoRng, RngCore, SeedableRng, TryCryptoRng, TryRngCore};",
)
text = text.replace(
    "R: BlockRngCore + SeedableRng,",
    "R: Generator<Output = [u32; 64]> + SeedableRng,",
)
text = text.replace(
    "R: BlockRngCore<Item = u32> + SeedableRng,",
    "R: Generator<Output = [u32; 64]> + SeedableRng,",
)
text = text.replace(
    "R: BlockRngCore<Item = u32> + SeedableRng + CryptoBlockRng,",
    "R: Generator<Output = [u32; 64]> + SeedableRng + CryptoGenerator,",
)
text = text.replace(
    "impl<R, Rsdr> BlockRngCore for ReseedingCore<R, Rsdr>",
    "impl<R, Rsdr> Generator for ReseedingCore<R, Rsdr>",
)
text = text.replace(
    "type Output = <R as Generator>::Output;",
    "type Output = [u32; 64];",
)
text = text.replace(
    "impl<R, Rsdr> CryptoBlockRng for ReseedingCore<R, Rsdr>",
    "impl<R, Rsdr> CryptoGenerator for ReseedingCore<R, Rsdr>",
)
text = text.replace("self.0.next_u32()", "{ let mut bytes = [0u8; 4]; self.0.fill_bytes(&mut bytes); u32::from_le_bytes(bytes) }")
text = text.replace("self.0.next_u64()", "{ let mut bytes = [0u8; 8]; self.0.fill_bytes(&mut bytes); u64::from_le_bytes(bytes) }")
text = text.replace("[`BlockRngCore::generate`]", "[`Generator::generate`]")

path.write_text(text)
PY
}

patch_xoshiro128() {
  local file="$1"
  python - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "utils::read_words" in text:
    sys.exit(0)

text = text.replace("use rand_core::{RngCore, SeedableRng, le};", "use rand_core::{RngCore, SeedableRng, utils};")
text = text.replace("let mut state = [0; 4];\n        le::read_u32_into(&seed, &mut state);", "let state: [u32; 4] = utils::read_words(&seed);")
text = text.replace("le::next_u64_via_u32(self)", "{ let lo = self.next_u32() as u64; let hi = self.next_u32() as u64; (hi << 32) | lo }")
text = text.replace(
    "le::fill_bytes_via_next(self, dst)",
    "{ let mut chunk = dst; while !chunk.is_empty() { let value = self.next_u32().to_le_bytes(); let take = chunk.len().min(4); chunk[..take].copy_from_slice(&value[..take]); chunk = &mut chunk[take..]; } }",
)

path.write_text(text)
PY
}

patch_xoshiro256() {
  local file="$1"
  python - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "utils::read_words" in text:
    sys.exit(0)

text = text.replace("use rand_core::{RngCore, SeedableRng, le};", "use rand_core::{RngCore, SeedableRng, utils};")
text = text.replace("let mut state = [0; 4];\n        le::read_u64_into(&seed, &mut state);", "let state: [u64; 4] = utils::read_words(&seed);")
text = text.replace(
    "le::fill_bytes_via_next(self, dst)",
    "{ let mut chunk = dst; while !chunk.is_empty() { let value = self.next_u64().to_le_bytes(); let take = chunk.len().min(8); chunk[..take].copy_from_slice(&value[..take]); chunk = &mut chunk[take..]; } }",
)

path.write_text(text)
PY
}

patch_step_rng() {
  local file="$1"
  python - "$file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "fill_bytes_via_next" not in text:
    sys.exit(0)

text = text.replace(
    "rand_core::le::fill_bytes_via_next(self, dst)",
    "{ let mut chunk = dst; while !chunk.is_empty() { let value = self.next_u64().to_le_bytes(); let take = chunk.len().min(8); chunk[..take].copy_from_slice(&value[..take]); chunk = &mut chunk[take..]; } }",
)

path.write_text(text)
PY
}

copy_crate "chacha20" "0.10.0-rc.5"
copy_crate "rand" "0.10.0-rc.5"

apply_patch "$VENDOR_DIR/chacha20/src/rng.rs" "CryptoGenerator"
patch_rand "$VENDOR_DIR/rand/src/rngs/reseeding.rs"
patch_xoshiro128 "$VENDOR_DIR/rand/src/rngs/xoshiro128plusplus.rs"
patch_xoshiro256 "$VENDOR_DIR/rand/src/rngs/xoshiro256plusplus.rs"
patch_step_rng "$VENDOR_DIR/rand/src/lib.rs"

cargo run --release -- "$@"
