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
NEED=$(solana rent "$SIZE" --url devnet | awk '/Rent-exempt minimum/ {print $3}')
echo "Program $ID, $SIZE bytes, ~$NEED SOL rent (plus a temporary buffer of about the same)"
echo "Wallet $(solana address): $(solana balance --url devnet)"

solana program deploy target/deploy/strata.so --program-id "$PROGRAM_KEYPAIR" --url devnet --max-sign-attempts 30 --use-rpc
solana program show "$ID" --url devnet
echo
echo "Deployed. Set on the website host:"
echo "  NEXT_PUBLIC_SOLANA_CLUSTER=devnet"
echo "  NEXT_PUBLIC_SOLANA_RPC=<a devnet RPC URL>"
echo "  NEXT_PUBLIC_STRATA_DATA=rpc"
echo "  NEXT_PUBLIC_PROGRAMS_LIVE=true"
