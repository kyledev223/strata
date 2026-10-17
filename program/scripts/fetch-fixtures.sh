#!/usr/bin/env bash
# Dump the Metaplex Token Metadata program for local tests and the local validator.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p tests/fixtures
[ -f tests/fixtures/mpl_token_metadata.so ] || solana program dump metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s tests/fixtures/mpl_token_metadata.so --url devnet
ls -la tests/fixtures
