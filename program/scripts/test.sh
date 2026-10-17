#!/usr/bin/env bash
# Math property tests + LiteSVM integration tests (needs a fresh build and the Metaplex fixture).
#   PROPTEST_CASES=100000 FUZZ_SEEDS=60 FUZZ_STEPS=400 scripts/test.sh   for a long soak
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f tests/fixtures/mpl_token_metadata.so ] || scripts/fetch-fixtures.sh
[ -f target/deploy/strata.so ] || scripts/build.sh
cargo test -p strata-math --release
cargo test -p strata-tests --release -- --nocapture
