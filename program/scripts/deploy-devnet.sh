#!/usr/bin/env bash
# Deploy strata to devnet. Needs:
#   - the program keypair at PROGRAM_KEYPAIR (default ~/.config/strata/strata-program-keypair.json),
#     whose address matches declare_id! in programs/strata/src/lib.rs
#   - ~6 devnet SOL in the CLI wallet (`solana address`) for rent + the upload buffer
#
# Devnet only. Mainnet is gated on an external audit and an immutable deploy
# (`solana program set-upgrade-authority <ID> --final`); see PROGRAM_SPEC.md §11.
set -euo pipefail
cd "$(dirname "$0")/.."
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-$HOME/.config/strata/strata-program-keypair.json}"
ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
grep -q "$ID" programs/strata/src/lib.rs || { echo "declare_id! doesn't match $ID"; exit 1; }

scripts/build.sh
SIZE=$(stat -c%s target/deploy/strata.so)
NEED=$(solana rent "$SIZE" --url "${RPC_URL:-devnet}" | awk '/Rent-exempt minimum/ {print $3}')
echo "Program $ID, $SIZE bytes, ~$NEED SOL rent (plus a temporary buffer of about the same)"
echo "Wallet $(solana address): $(solana balance --url "${RPC_URL:-devnet}")"

# Public devnet RPC drops many write transactions; set RPC_URL to your Helius devnet URL if this struggles.
# Priority fees + generous retries help uploads land when devnet is busy.
URL="${RPC_URL:-devnet}"
solana program deploy target/deploy/strata.so --program-id "$PROGRAM_KEYPAIR" --url "$URL"   --with-compute-unit-price "${CU_PRICE:-50000}" --max-sign-attempts 100
solana program show "$ID" --url "$URL"
echo
echo "Deployed. Set on the website host:"
echo "  NEXT_PUBLIC_SOLANA_CLUSTER=devnet"
echo "  NEXT_PUBLIC_SOLANA_RPC=<a devnet RPC URL>"
echo "  NEXT_PUBLIC_STRATA_DATA=rpc"
echo "  NEXT_PUBLIC_PROGRAMS_LIVE=true"
