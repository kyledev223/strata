#!/usr/bin/env bash
# Deploy strata to MAINNET. Real SOL, real users. Every guard below is deliberate.
#
#   CONFIRM_MAINNET=yes \
#   RPC_URL=https://mainnet.helius-rpc.com/?api-key=... \
#   TREASURY_CONFIRM=<the treasury address in config/limits.json> \
#   program/scripts/deploy-mainnet.sh
#
# Leaves the program UPGRADEABLE (authority = your CLI wallet) so you can smoke-test
# with small amounts. Then run scripts/finalize-mainnet.sh to make it immutable,
# which is what the "no upgrade path can drain the vault" invariant requires
# (PROGRAM_SPEC.md I13, §11). Until then, that wallet's key can replace the program.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "ERROR: $*" >&2; exit 1; }
[ "${CONFIRM_MAINNET:-}" = "yes" ] || die "set CONFIRM_MAINNET=yes to deploy to mainnet"
[ -n "${RPC_URL:-}" ] || die "set RPC_URL to a private mainnet RPC (public RPC drops deploy transactions)"

PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-$HOME/.config/strata/strata-program-keypair.json}"
ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
grep -q "declare_id!(\"$ID\")" programs/strata/src/lib.rs || die "declare_id! doesn't match $ID"

TREASURY=$(python3 -c 'import json;print(json.load(open("../config/limits.json"))["launch"]["treasury"])')
[ "${TREASURY_CONFIRM:-}" = "$TREASURY" ] || die "treasury compiled into the program is $TREASURY; set TREASURY_CONFIRM to exactly that to proceed"

echo "== build (SBPF v0) and test"
scripts/build.sh
FLAGS=$(readelf -h target/deploy/strata.so | awk '/Flags:/ {print $2}')
[ "$FLAGS" = "0x0" ] || die "binary is not SBPF v0 (flags $FLAGS); mainnet can't run it"
scripts/test.sh > /tmp/strata-mainnet-tests.log 2>&1 || { tail -40 /tmp/strata-mainnet-tests.log; die "tests failed"; }
grep -E "test result: ok" /tmp/strata-mainnet-tests.log | head -3
sha256sum target/deploy/strata.so | tee target/deploy/strata.so.sha256

SIZE=$(stat -c%s target/deploy/strata.so)
RENT=$(solana rent "$SIZE" --url "$RPC_URL" | awk '/Rent-exempt minimum/ {print $3}')
NEED=$(python3 -c "print(round(2 * $RENT + 0.05, 3))")
BAL=$(solana balance --url "$RPC_URL" | awk '{print $1}')
echo "== program $ID ($SIZE bytes), rent $RENT SOL, need ~$NEED SOL during deploy, wallet $(solana address) has $BAL SOL"
python3 -c "import sys; sys.exit(0 if $BAL >= $NEED else 1)" || die "fund $(solana address) with at least $NEED SOL"

echo "== deploying to mainnet"
solana program deploy target/deploy/strata.so \
  --program-id "$PROGRAM_KEYPAIR" \
  --url "$RPC_URL" \
  --use-rpc \
  --with-compute-unit-price "${CU_PRICE:-100000}" \
  --max-sign-attempts 50
solana program show "$ID" --url "$RPC_URL"

cat <<EOF

Deployed to mainnet, still UPGRADEABLE by $(solana address).
Next:
  1. In Vercel set NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta, NEXT_PUBLIC_SOLANA_RPC=<mainnet RPC>,
     NEXT_PUBLIC_STRATA_DATA=rpc, NEXT_PUBLIC_PROGRAMS_LIVE=true, then redeploy.
  2. Smoke-test with small amounts: launch, buy, sell, redeem, claim.
  3. CONFIRM_FINAL=yes RPC_URL=... scripts/finalize-mainnet.sh   (irreversible)
EOF
