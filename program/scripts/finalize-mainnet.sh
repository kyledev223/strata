#!/usr/bin/env bash
# Make the mainnet program IMMUTABLE. Irreversible: no fixes after this, by anyone.
# This is what makes "no upgrade path can drain the vault" true (PROGRAM_SPEC.md I13).
#
#   CONFIRM_FINAL=yes RPC_URL=https://mainnet.helius-rpc.com/?api-key=... program/scripts/finalize-mainnet.sh
set -euo pipefail
cd "$(dirname "$0")/.."
die() { echo "ERROR: $*" >&2; exit 1; }
[ "${CONFIRM_FINAL:-}" = "yes" ] || die "set CONFIRM_FINAL=yes; this cannot be undone"
[ -n "${RPC_URL:-}" ] || die "set RPC_URL to your mainnet RPC"
ID=$(grep -o 'declare_id!("[^"]*")' programs/strata/src/lib.rs | cut -d'"' -f2)

echo "== on-chain program vs local build"
solana program dump "$ID" /tmp/strata-onchain.so --url "$RPC_URL" >/dev/null
# The dump is padded to the account size; compare the build's length prefix.
SIZE=$(stat -c%s target/deploy/strata.so)
cmp -n "$SIZE" /tmp/strata-onchain.so target/deploy/strata.so || die "on-chain program differs from target/deploy/strata.so"
echo "matches $(cut -d' ' -f1 target/deploy/strata.so.sha256 2>/dev/null || sha256sum target/deploy/strata.so | cut -d' ' -f1)"

solana program set-upgrade-authority "$ID" --final --url "$RPC_URL"
solana program show "$ID" --url "$RPC_URL"
echo "Immutable. Authority should read: none."
