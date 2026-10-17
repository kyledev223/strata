#!/usr/bin/env bash
# Build the strata program and copy its IDL + TS types into the website.
#
# SBPF v0 on purpose: Anchor 1.2 defaults to v3, but devnet and mainnet don't
# have SBPFv3 enabled yet, so a v3 binary deploys but can never run there.
set -euo pipefail
cd "$(dirname "$0")/.."
anchor build --arch v0
if [ -d ../lib/strata/idl ]; then
  cp target/idl/strata.json ../lib/strata/idl/strata.json
  cp target/types/strata.ts ../lib/strata/idl/strata.ts
  echo "Built $(stat -c%s target/deploy/strata.so) bytes; IDL copied to lib/strata/idl/"
else
  echo "Built $(stat -c%s target/deploy/strata.so) bytes (not inside the repo, so the IDL wasn't copied)"
fi
