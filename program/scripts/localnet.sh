#!/usr/bin/env bash
# Local validator with strata and Metaplex at their real addresses, on http://127.0.0.1:8899.
# Point the site at it with:
#   NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899 NEXT_PUBLIC_SOLANA_CLUSTER=localnet \
#   NEXT_PUBLIC_STRATA_DATA=rpc NEXT_PUBLIC_PROGRAMS_LIVE=true npm run dev
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f tests/fixtures/mpl_token_metadata.so ] || scripts/fetch-fixtures.sh
[ -f target/deploy/strata.so ] || scripts/build.sh
exec solana-test-validator --reset --ledger .anchor/test-ledger --rpc-port 8899 \
  --bpf-program "$(grep -o '[1-9A-HJ-NP-Za-km-z]\{32,44\}' ../lib/strata/idl/strata.json | head -1)" target/deploy/strata.so \
  --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s tests/fixtures/mpl_token_metadata.so
