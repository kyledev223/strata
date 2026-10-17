# Strata program spec (Phase 2, devnet)

Status: **implemented, tested and live on devnet.** The program lives in `program/`; see §14 for what was built and how it was verified. Worked numbers come from an exact integer model and are asserted by the math crate's tests.

## 0. Decisions (all taken as recommended)

| # | Decision | Taken |
|---|---|---|
| D1 | One program or four (curve, reserve, redemption, fee router)? | **One program** with internal modules. The floor invariant spans buy, sell and redeem, and a single program can check it in one place with no cross-program trust. See §3. |
| D2 | Mitigate JIT floor capture (§8, A2) with a surplus drip? | **Yes**, drip the *surplus* above backing into the reserve over 150 slots (about 60 s). Backing still lands immediately, so the floor never dips. |
| D3 | What happens when the curve runs out of supply (1B tokens)? | Buys stop, sells and redemption continue. **No AMM migration in v1** (§5.2). |
| D4 | Token metadata mutable after launch? | **Immutable** (`is_mutable = false`), so a name or image can't be swapped after people buy. |
| D5 | Where does the 0.02 SOL launch fee go? | A hard-coded treasury address. It never touches any vault. |
| D6 | Show buyers a separate "buy price"? | **Yes.** Near the floor, a buy costs up to about 2x spot (§9). The Buy tab shows "You pay per token" and its multiple of spot. |

## 1. Scope

In scope: one Anchor program on **devnet only**, its tests, and a devnet soak. The UI's RPC data source gets wired to devnet at the end.

Out of scope: mainnet deployment, an AMM migration, and any admin, pause or upgrade mechanism on mainnet (§11).

## 2. Units and numbers

| Quantity | Type | Unit |
|---|---|---|
| SOL amounts, reserve `R`, curve SOL | `u64` | lamports (1 SOL = 10^9) |
| Token amounts, circulating supply `S` | `u64` | base units, **6 decimals** (1 token = 10^6) |
| Virtual reserves `vS`, `vT` | `u64` | lamports, base units |
| `k = vS * vT`, any product | `u128` | |
| Basis points | `u16` | 10,000 = 100% |

The floor is a ratio, `R / S` lamports per base unit, and is **never stored or compared as a division**. Two floors compare by cross-multiplication in `u128`:

```
floor_after >= floor_before   <=>   R_after * S_before >= R_before * S_after
```

Headroom: total SOL is about 6e17 lamports and max supply is 1e15 base units, so two-term products stay under 1e33, well inside u128 (3.4e38). **One exception:** the sell-room product `k * (1e4 - f) * S` in §6.4 can reach about 6e44, so it uses a 256-bit intermediate (`ruint` or `primitive-types` U256) before the square root. All arithmetic is checked; overflow is an error, never a wrap.

Rounding helpers: `ceil_div(a, b) = (a + b - 1) / b`, `isqrt` = integer Newton square root (floor).

## 3. Architecture

**One program, `strata`**, with modules `curve`, `reserve`, `redemption`, `fees`. The reserve vault is debited in exactly one function, `reserve::pay_out`, which is reachable only from the `redeem` instruction and the redemption leg of `sell`.

Why one program: four programs would need the vault program to trust CPIs from the redemption program, which adds account-substitution and signer-seed surface. It would also split the floor check across program boundaries. The UI footer currently lists four placeholder addresses; with D1 accepted it becomes one program plus the treasury.

Token standard: **classic SPL Token**, not Token-2022. Token-2022 extensions (transfer hooks, transfer fees, permanent delegate) would let a mint call arbitrary code during our CPIs or move holders' tokens. `initialize_launch` creates the mint itself, so no foreign mint can be attached.

Supply model: **mint on buy, burn on sell and redeem.** Circulating supply is exactly `mint.supply`; there are no pre-minted curve tokens to account for. The vesting escrow holds minted tokens and counts as circulating (they were backed when bought).

## 4. Accounts

| Account | Seeds | Owner | Holds |
|---|---|---|---|
| `Launch` | `["launch", mint]` | strata | All per-token state (below). Never closed. |
| `ReserveVault` | `["vault", launch]` | strata | Lamports: `rent_min + R + pending + untracked`. 8-byte discriminator, no other data. Never closed. |
| `CurveVault` | `["curve", launch]` | strata | Lamports: `rent_min + curve_lamports`. Pays the curve leg of sells. |
| `CreatorFeeVault` | `["creator_fees", launch]` | strata | Accrued creator fees until claimed. |
| `VestingEscrow` | `["vest", launch]` | SPL Token | Token account, authority = `Launch` PDA. Holds the creator's first buy. |
| Mint | new keypair | SPL Token | Decimals 6. Mint authority = `Launch` PDA. **Freeze authority = none.** |
| Metadata | Metaplex PDA | Token Metadata | Name, ticker, URI. `is_mutable = false` (D4). |

Vaults are **program-owned** so the system program can't move lamports out of them; only strata code can debit them. Anyone can *credit* them; see A9.

There is **no global config account and no admin key**. Limits are compile-time constants generated from `config/limits.json` (§12). The launch-fee treasury is a constant.

`Launch` fields:

```
version u8, bumps { launch, vault, curve, creator_fees, vest } u8
mint, creator: Pubkey
settings (immutable after init):
  reserve_share_bps u16, fee_to_reserve_bps u16, creator_fee_bps u16,
  vesting_days u16 (0 = none), redemption_opens_at i64
created_at i64
curve:   virtual_sol u64, virtual_tokens u64, curve_lamports u64
reserve: reserve_lamports u64 (R), circulating u64 (S)
hwm:     hwm_reserve u64, hwm_supply u64        // last (R, S) with S > 0
drip:    pending_surplus u64, drip_from_slot u64, drip_until_slot u64   // if D2
vesting: vest_total u64, vest_claimed u64
stats:   floor_raises u64, redeemed_base_units u64, redeemed_lamports u64,
         fees_to_reserve u64, creator_fees_accrued u64
```

## 5. Instructions

Every state-changing instruction ends with `check_invariants(before, after)` (§7). Any failure reverts the whole transaction.

### 5.1 `initialize_launch(name, ticker, uri, settings, first_buy_lamports, min_tokens_out)`

1. Validate the settings against the limits (§12). `redemption_opens_at = now + delay_hours * 3600`.
2. Create the mint, metadata, `Launch`, vaults and escrow. Transfer the launch fee to the treasury.
3. Initialise the curve: `virtual_sol = 30 SOL`, `virtual_tokens = 1.073B tokens`. Set `R = 0`, `S = 0`, no high-water mark.
4. If `first_buy_lamports > 0`, run the buy logic (§6.3) with the escrow as recipient, and set `vest_total` if vesting is on.

### 5.2 `buy(lamports_in, min_tokens_out)`

Runs §6.3. It fails with `FloorDilution` if the deposit is below the backing requirement, `ZeroOutput` if no tokens result, `BelowMinBuy` under the configured minimum, and `Slippage` if the result is below `min_tokens_out`.

Curve exhaustion: a buy that would take `virtual_tokens` below `virtual_tokens_start - max_supply` fails with `CurveExhausted`; the UI shows how many tokens are left and sizes the buy. Status is "complete" while the inventory is zero; sells push tokens back, so it can reopen (D3). With the default curve, selling out all 1B tokens takes about 411 SOL into the curve (roughly 550 SOL of buys including reserve shares and fees), which caps the size of any single buy.

### 5.3 `sell(tokens_in, min_lamports_out)` (routed)

Runs §6.4: the curve leg first, then the redemption leg in the same instruction. Fails with `RedemptionNotOpen` if a redemption leg is needed before `redemption_opens_at`. The UI tells the user how much can go to the curve.

### 5.4 `redeem(tokens, min_lamports_out)`

Runs §6.5. No fee. Fails with `RedemptionNotOpen`, `DustRedemption` (payout would be 0 lamports), `ResidualSupplyTooSmall` (I8) or `Slippage`.

### 5.5 `claim_vested()`, `claim_creator_fees()`

The creator claims linearly vested tokens from the escrow, or accrued creator fees from `CreatorFeeVault`. Neither touches `R` or the reserve vault.

### 5.6 `sync_reserve()` (permissionless)

Adds untracked vault lamports (donations) to `R`. Only allowed when `S > 0` (I4). It can only raise the floor.

### 5.7 `release_drip()` (only if D2; also run at the start of every instruction)

Moves the elapsed share of `pending_surplus` into `R`. Only adds to `R`, and only when `S > 0`.

Events: every buy, sell, redeem and claim emits `TradeEvent { kind, mint, user, lamports, tokens, reserve_after, supply_after, slot }` for the indexer that feeds the UI's volume and history.

## 6. Floor math

Notation: `R` reserve lamports, `S` circulating base units, `F = R / S`. Settings are `rs` (reserve share), `rf` (fee to reserve) and `cf` (creator fee), all in bps.

### 6.1 Rounding table: every rounding favours the vault

| Quantity | Rounds | Reason |
|---|---|---|
| Reserve fee `ceil(L * rf / 10^4)` | up | owed to the reserve |
| Reserve share `ceil(net * rs / 10^4)` | up | owed to the reserve |
| Backing requirement `ceil(t * R / S)` | up | owed to the reserve |
| Creator fee `floor(L * cf / 10^4)` | down | not the vault's; buyer keeps the dust |
| Tokens out of the curve | down | paid to the user |
| SOL the curve needs for `t` tokens | up | paid by the user |
| Curve SOL out on a sell | down | paid to the user |
| Curve room on a routed sell (`isqrt`) | down | keeps the curve leg at or above the floor |
| Redemption payout `floor(T * R / S)` | down | paid from the reserve |

Redeeming the **entire** supply pays exactly `R`, so the vault ends at 0 with no orphaned dust.

### 6.2 Required floor and zero supply

```
required_floor = R / S                    if S > 0
               = hwm_reserve / hwm_supply if S = 0 and a high-water mark exists
               = none (no requirement)    if this is the first buy ever
```

### 6.3 Buy

```
creator_fee = floor(L * cf / 1e4)
reserve_fee = ceil (L * rf / 1e4)
net         = L - creator_fee - reserve_fee
share       = ceil(net * rs / 1e4)

t1 = tokens_out(curve, net - share)
if ceil(t1 * F) <= share:                      // share path
    t = t1, deposit = share, to_curve = net - share
else:                                          // top-up path
    t = max t in [0, t1] with ceil(t * F) + curve_cost(t) <= net   (bisection, <= 64 steps)
    to_curve = curve_cost(t), deposit = net - to_curve
assert deposit >= ceil(t * F)                  // I1, else FloorDilution

R += deposit + reserve_fee ; S += t ; vS += to_curve ; vT -= t
creator_fees += creator_fee                    // to CreatorFeeVault
```

`tokens_out(x) = vT - ceil(k / (vS + x))` and `curve_cost(t) = ceil(k / (vT - t)) - vS`. Bisection works because the cost is monotonic in `t`. Any rounding surplus in the top-up path lands in the reserve.

### 6.4 Sell (routed)

The curve's marginal price after selling `t` tokens is `k / (vT + t)^2`. The curve leg runs only while that price, net of fees, is still at least the floor:

```
f      = rf + cf
room   = isqrt( k * (1e4 - f) * S / (1e4 * R) ) - vT      (0 if negative; numerator in U256)
t_c    = min(tokens_in, room)

curve leg:    vT' = vT + t_c ; vS' = ceil(k / vT') ; gross = vS - vS'
              creator_fee = floor(gross * cf), reserve_fee = ceil(gross * rf)
              user gets gross - fees ; R += reserve_fee ; S -= t_c (burn)
redeem leg:   t_r = tokens_in - t_c, paid by §6.5 at the *updated* floor
```

The curve leg is paid from `CurveVault`, never from the reserve. Burning `t_c` without touching `R` raises the floor.

### 6.5 Redeem

```
payout = R                    if T = S
       = floor(T * R / S)     otherwise
R -= payout ; S -= T (burn)
```

`R*(S-T)/S <= R - payout`, so the floor ties or rises.

### 6.6 Worked numbers

All examples use settings `rs = 25%`, `rf = 1%`, `cf = 0.5%`, and a curve at `vS = 60 SOL`, `vT = 100M tokens` (spot 6.0e-7 SOL per token).

**W1. Redemption holds the floor.** `R = 240 SOL`, `S = 600M` gives a floor of 4.0e-7 SOL per token. Redeem 90M:
`payout = floor(90e12 * 240e9 / 600e12) = 36,000,000,000` lamports = **36 SOL**. After: `R = 204 SOL`, `S = 510M`, floor **4.0e-7**.
Cross-check: `204e9 * 600e12 = 240e9 * 510e12 = 1.224e26`. Equal.

**W2. A fee raises it.** Add a 12 SOL fee to W1's result: `R = 216`, floor **4.235294e-7, +5.8824%**.

**W3. Buy, share path.** `R = 60 SOL`, `S = 500M` (floor 1.2e-7, 0.2x spot). Buy 10 SOL:
creator fee 0.05 · reserve fee 0.1 · net 9.85 · share 2.4625 · to curve 7.3875
tokens out **10,962,715.637173** · backing required 1.315525877 SOL is under the share, so deposit = 2.4625.
Floor after **1.224404e-7** (up), spot after 7.568459e-7.

**W4. Buy, top-up path.** `R = 204 SOL`, `S = 510M` (floor 4.0e-7, 0.67x spot). Buy 10 SOL.
The naive share path would mint 10,962,716 tokens needing 4.385086 SOL of backing against a 2.4625 SOL share, which dilutes the floor. That fails I1. The solved buy:
tokens out **9,280,384.2775** · deposit = required = **3.712153711 SOL** · to curve 6.137846289.
Floor after **4.001926e-7** (up), spot after 7.290358e-7. The buyer paid 1.0775e-6 per token, **1.80x spot** (see §9).

**W5. Routed sell.** W4's starting state, sell 50M tokens (fees 1.5%):
curve room = **21,552,457.811432** tokens, at which the net marginal price is exactly 4.0e-7, the floor.
Curve leg: gross 10.638595812 · creator fee 0.053192979 · reserve fee 0.106385959 · seller gets 10.479016874 SOL.
Redeem leg: 28,447,542.188568 tokens pay **11.881109239 SOL**. The curve leg's reserve fee goes to the drip (D2), so it rewards the holders who stay rather than lifting the floor this seller exits at.
**Total 22.360126113 SOL**, against 20 SOL for redeeming all 50M at the floor.

**W6. Rounding favours the vault.** `R = 1,000,000,007` lamports, `S = 3,000,000,000` base units (3,000 tokens). Redeem 1,000 tokens:
exact share 333,333,335.67 → pays **333,333,335**. After: `R = 666,666,672`, `S = 2e9`.
Floor 0.3333333357 → **0.333333336** lamports per base unit (up by the dust).

**W7. Zero supply.** From W1's start, redeem all 600M: payout exactly **240 SOL**, `R = 0`, `S = 0`, high-water mark 4.0e-7.
The next buy of 1 SOL must back at the mark: tokens out 979,190.23, deposit **0.391676092 SOL** (= mark x tokens). Floor after 4.102125e-7.

**W8. Dust attack, rejected.** From W1's start, redeem all but **one base unit**. The payout would round down and leave **1 lamport** behind 1 base unit: floor 1.0e-3 SOL per token, a **2,500x** spike. Every later buy would then have to back at the spiked floor, which bricks the launch. It's rejected by I8 (`ResidualSupplyTooSmall`, minimum residual 1,000 tokens). With that minimum, a lamport of dust moves the floor by at most 1e-9 lamports per base unit.

## 7. Invariants

Checked by `check_invariants` at the end of **every** state-changing instruction, comparing against a snapshot taken at the start.

| # | Invariant | How it's enforced |
|---|---|---|
| I1 | Every buy adds at least `ceil(t * required_floor)` to the reserve, or fails. | §6.3 assert → `FloorDilution` |
| I2 | Sells go to the curve only while its net marginal price is at least the floor; the rest is redeemed in the same instruction. | §6.4 `room` computation |
| I3 | Every rounding favours the vault. | §6.1; property tests P3, P5 |
| I4 | `S = 0` implies `R = 0`. `sync_reserve` and the drip release are no-ops at `S = 0`. Every division is guarded. | assert + guards |
| I5 | The reserve vault is a program-owned PDA. Only `reserve::pay_out` debits it, from `redeem` and the sell redemption leg. It has no close instruction, no admin, no withdraw path. | code structure; test greps for lamport debits |
| I6 | Creator fee and fee-to-reserve are taken in SOL, from the buyer's input or the curve's output. Never from the reserve. | §6.3 / §6.4; P8 |
| I7 | The floor never decreases: `R' * S >= R * S'` when both supplies are positive; against the high-water mark when `S = 0`. | `check_invariants` → `FloorDecreased` |
| I8 | After any instruction, `S = 0` or `S >= MIN_CIRCULATING` (1,000 tokens). | `check_invariants` → `ResidualSupplyTooSmall` |
| I9 | `mint.supply == S` (the mint is reloaded after token CPIs). | `check_invariants` |
| I10 | `reserve_vault.lamports >= rent_min + R + pending_surplus`. | `check_invariants` |
| I11 | Curve solvency: `curve_vault.lamports >= rent_min + curve_lamports`, `curve_lamports >= vS - vS_start`, and `k` never decreases. | `check_invariants` |
| I12 | Settings never change after `initialize_launch`. | no instruction writes them |
| I13 | Mainnet program is immutable (upgrade authority = none). | deployment gate, §11 |

I11's solvency argument: `S` is at most the tokens that ever left the curve, because redemptions only burn. Selling all `S` back can therefore pay at most `vS - k / vT_start = vS - vS_start`, which is exactly `curve_lamports`.

## 8. Attack cases

All numbers from the exact model. The base state is W4's (`R = 204 SOL`, `S = 510M`, spot 6.0e-7).

**A1. Sandwich around a buy (generic curve MEV).** The attacker buys before the victim and sells after. The floor neither causes nor prevents this; the victim's slippage limit bounds their loss.

| Victim buy | Victim slippage | Max front-run | Attacker PnL |
|---|---|---|---|
| 50 SOL | 1% | 0.79 SOL | +0.35 SOL |
| 200 SOL | 1% | 0.79 SOL | +4.59 SOL |
| 1000 SOL | 1% | 0.95 SOL | +85.86 SOL |
| 1000 SOL | 5% | 4.86 SOL | +297.82 SOL |

The victim pays at most their slippage over the quote. Most of the attacker's PnL comes from the victim's own price impact, which every earlier holder also gets. Mitigations: 1% default slippage (already in the UI) and, later, an optional private transaction route.

**A2. JIT floor capture (front-run a large buy, redeem right after).** A large buy deposits its reserve share and lifts the floor. A front-runner holding tokens could capture a pro-rata slice of that lift.

Two things close it:
1. **The supply cap.** The pre-implementation model had no cap and showed profit only for buys of roughly 25x the reserve (5,000+ SOL against 204). On the real curve no single buy can exceed about 550 SOL, so those cases can't occur.
2. **The drip (D2).** Only the *backing* (`ceil(t * F)`) enters `R` immediately; the *surplus* (`deposit - backing + reserve_fee`) is released linearly over 150 slots. The floor never decreases, but capturing the lift means holding through the drip, with price risk, and it can't be done atomically.

Measured on the compiled program (LiteSVM, `attacks::jit_floor_capture_is_unprofitable_with_drip`), attacker buys, whale buys one slot later, attacker redeems one slot after that:

| First buy (reserve size) | Attacker | Whale | Attacker PnL |
|---|---|---|---|
| 0.5 SOL | 10 SOL | 300 SOL | **−7.86 SOL** |
| 1 SOL | 50 SOL | 400 SOL | **−43.87 SOL** |
| 2 SOL | 1 SOL | 150 SOL | **−0.76 SOL** |

**A3. Sandwich around a redemption.** A redemption doesn't move the floor except by round-down dust. In a 123,456,789.123456-token redemption from the base state, `R' * S = 7.8854815019010e25 >= R * S' = 7.8854815018815e25`. There is no price to push. Front-running a redeem with a buy costs fees and earns nothing.

**A4. Sandwich around a routed sell.** An attacker sells first to push the curve toward the floor, so the victim's tokens route to redemption. The victim still receives at least the floor for every token, plus `min_lamports_out` protection. The attacker's own sell also paid at least the floor, so there's no cheap buy-back below it.

**A5. JIT around a large sell.** A sell adds only its fee to the reserve, not a share. Front-running a 50M or 200M sell with 10 SOL and redeeming after: **−6.05 SOL**. Not profitable.

**A6. Rounding drains.** Every path rounds toward the vault (§6.1), so repeating any operation can't extract value. A single actor's buy-then-exit cycle always loses at least the fees. Dust operations are rejected: `ZeroOutput`, `DustRedemption`, and `BelowMinBuy` (0.001 SOL).

**A7. Dust residual spike.** See W8. Fixed by I8. The property test found this one.

**A8. Zero supply.** Handled by I4, W7, the high-water mark requirement, and guarded divisions. The first-ever buy has no requirement, so it sets the starting floor.

**A9. Donations.** Lamports sent straight to the reserve vault stay untracked until `sync_reserve`, which only raises the floor and is a no-op at `S = 0`. That stops a donation at zero supply being captured by whoever buys next. Donations to the curve vault are ignored.

**A10. Creator-fee denial of service.** Paying fees straight to a creator wallet with a 0 balance would fail rent-exemption and block every trade. Fees therefore accrue in `CreatorFeeVault` and are claimed later.

**A11. Account substitution.** Every account is a PDA checked by seeds, or checked with `has_one` (`launch.mint`, `launch.creator`). The token program must be classic SPL. The mint must be the one stored in `Launch`.

**A12. Mint and freeze abuse.** The mint authority is the `Launch` PDA and mints only inside the buy path, paired with a deposit. There is no freeze authority, so holders can't be frozen out of redeeming.

**A13. Upgrade or admin drain.** There are no admin instructions and no close on the vault or `Launch`. On mainnet the program must be immutable. Any upgrade authority, including a multisig or timelock, is a path that could drain the vault, so "no upgrade path" means deploying with `--final`.

**A14. Reserve-share edge cases.** `rs` is bounded to 5–60%, so `R` grows with every buy and `share <= net` always. When the floor is above `rs / (1 - rs)` times the curve price, every buy takes the top-up path (W4). That's correct but expensive for buyers (§9). Fees are capped at 2% each, so `net` is always positive. Settings are frozen at launch.

**A15. Overflow and compute.** All intermediate products are u128 and every operation is checked. The bisection runs at most 64 steps and `isqrt` is bounded. Expect each instruction to stay well under 200k compute units; this will be measured in tests.

**A16. Reentrancy.** The program only CPIs into the System, SPL Token and Token Metadata programs. Classic SPL has no hooks, so nothing calls back into strata mid-instruction.

**A17. Launch sniping.** Optional redemption delay (up to 72 h) plus first-buy vesting.

**A18. Clock skew.** Redemption delay and vesting use `Clock::unix_timestamp`. Validator skew is a few seconds, which is immaterial for windows measured in hours or days.

## 9. Economic note: what a buyer pays

The reserve share and the backing rule mean a buy costs more per token than the spot price the UI shows. One 1 SOL buy at spot 6.0e-7:

| Floor / spot | Path | Paid per token | vs spot |
|---|---|---|---|
| 0.2 | share | 8.22e-7 | 1.37x |
| 0.5 | top-up | 9.20e-7 | 1.53x |
| 0.67 | top-up | 1.02e-6 | 1.70x |
| 0.95 | top-up | 1.19e-6 | 1.99x |

The seller side pays the larger of the curve's price and the floor. That spread is what funds the floor. The UI should show a "buy price" and a "sell price" (D6).

## 10. Test plan

**Layer 1: pure math crate (`strata-math`).** No Solana dependencies. The program calls this crate, and every test runs against it.

Property tests (`proptest`) run random sequences of up to 200 operations across 4–8 actors: buy, sell, redeem, fee, sync, drip, claim. Amounts are biased toward edges: 0, 1, `MIN_CIRCULATING ± 1`, `S − 1`, `S`, `u64::MAX`, the exact sell room ±1, and amounts that cross the top-up threshold. Every property is checked **after every operation**, not just at the end.

| # | Property |
|---|---|
| P1 | The floor never decreases (I7), including through `S = 0` and back. |
| P2 | Every buy's deposit is at least `ceil(t * required_floor)` (I1). |
| P3 | Total payouts never exceed total deposits plus fees: conservation of lamports. |
| P4 | Curve solvency and `k` monotonic (I11). |
| P5 | No free lunch: a single actor's cycle that starts and ends holding no tokens never ends with more SOL. A2's JIT is a two-actor exception with its own test. |
| P6 | `S = 0` implies `R = 0`; `S = 0` or `S >= MIN_CIRCULATING` (I4, I8). |
| P7 | Routed sells pay at least the pure-redemption payout for the same tokens. |
| P8 | No instruction except redemption lowers `R` (I5, I6). |
| P9 | Rounding: every redemption payout is at most the exact `T * R / S`; every deposit is at least the exact requirement. |
| P10 | Deterministic: the same inputs always give the same outputs. |

Shrinking reports the minimal failing sequence. CI runs 10,000 cases per pull request and 1,000,000 nightly.

**Layer 2: differential test against the UI.** Generate 10,000 random states and operations. Run them through the Rust math and through `lib/floor.ts` (a Node script emitting JSON), and require agreement within 1 lamport and 1 base unit. That keeps the UI's quotes honest.

**Layer 3: coverage-guided fuzzing.** A `cargo-fuzz` target interprets arbitrary bytes as an operation sequence and asserts P1–P9. It's seeded with W1–W8 and the dust attack, and runs an hour nightly.

**Layer 4: mutation testing.** `cargo-mutants` on `strata-math`: flip each rounding direction, drop the top-up branch, drop the residual check. Every mutant must be caught by the property tests. A surviving mutant means a missing test.

**Layer 5: program tests in an in-process SVM** (LiteSVM or bankrun):
- Happy path and every error code for each instruction.
- Account substitution: wrong vault, wrong mint, a Token-2022 mint, a foreign `Launch`.
- Rent edge cases, including a creator wallet with a 0 balance (A10).
- A stateful fuzz harness (Trident or a custom LiteSVM loop) sends random instruction sequences from many wallets. After every transaction it reads the accounts and checks I4 and I7–I11 *from chain state*, independently of the program's own checks.
- Compute-unit budget per instruction at worst-case inputs.
- Attack replays: A1, A2 (with and without the drip), A5 and W8 as fixed scenarios with expected PnL signs.

**Layer 6: devnet.**
- Deploy upgradeable to devnet only.
- Run bots trading randomly against several launches for 48 hours.
- A watcher snapshots every `Launch` and vault each slot and alerts on any floor decrease or invariant break.
- Switch the UI to `NEXT_PUBLIC_STRATA_DATA=rpc` against devnet and click through every flow.

**Exit criteria for Phase 2:**
- All layers green.
- Zero invariant alerts during the soak.
- Measured compute units recorded.
- Decisions D1–D6 resolved.

## 11. Deployment

Devnet only in Phase 2, upgradeable so we can iterate.

Mainnet is out of scope. When it comes up, the gates are an external audit and **immutable deployment**, with the upgrade authority set to none. There's no pause key either: a pause is an admin key that could freeze redemptions.

## 12. Limits and config

`config/limits.json` is the single source for every limit: settings ranges, minimum residual supply, minimum buy, launch fee, curve start and supply cap. The UI reads it through `lib/limits.ts`. For the program, a build step generates `programs/strata/src/limits.rs` constants from the same file, and CI fails if the generated file is stale. Limits are compile-time constants rather than an on-chain config, so no key can change them; changing one means redeploying.

## 13. UI changes this spec implies

- "Curve complete" in the mock means more than 70 SOL in the curve. The spec defines it as zero curve inventory.
- Show a buy price next to the spot price (D6).
- Footer program list goes from four placeholders to one program plus the treasury (D1).
- `lib/floor.ts` implements §6 in floating point, including top-up, routing, rounding, the high-water mark, the minimum residual and the drip (pending surplus is treated as not yet released, which is conservative). A Rust-vs-TypeScript differential test (Layer 2) is still to do.

## 14. Implementation status

**Code** (`program/`, Anchor 1.2.1, Solana v4 crates):
- `crates/strata-math`: §6 in exact integers; limits generated at build time from `config/limits.json` (§12).
- `programs/strata`: 8 instructions (`initialize_launch`, `creator_buy`, `buy`, `sell`, `redeem`, `claim_vested`, `claim_creator_fees`, `sync_reserve`), `check_invariants` at the end of every state-changing instruction, hourly/daily stats rings and `Trade` events for the UI.
- Program ID `2KXPBww71SmCwdh4MAZ8P8UdpkzmFx8eNFd1437Hbw8s`. The keypair is kept outside the repo.
- **Built for SBPF v0** (`anchor build --arch v0`). Anchor 1.2 defaults to v3, but SBPFv3 is inactive on devnet and mainnet, so a v3 binary deploys and then never runs. Found by the local-validator test.

**Verification:**

| Layer | Result |
|---|---|
| Math unit tests (W1–W8, errors, edge cases) | 10 pass, worked numbers exact |
| Math properties P1–P5, P7 | pass at 100,000 cases each |
| LiteSVM integration (lifecycle, vesting, drip, routed sells, redemption, claims, dust, zero supply, delay, slippage, substitution, settings, JIT, donations, vault ownership) | 13 pass |
| LiteSVM stateful fuzz, invariants re-read from chain state after every tx | 20,357 txs across 60 launches, 0 violations |
| Local validator + real UI (Playwright, real signatures): launch with vesting, buy, routed sell, redeem, claim fees, projects/redeem/home pages | 23/23 checks, invariants re-read from chain after each tx |
| **Devnet** + real UI, same flow with real devnet transactions | all transactions confirmed, invariants held, floor only rose; zero console errors in normal browsing |

**Compute units** (measured): launch + first buy 150k (one transaction), buy 57k (top-up path), routed sell 111k, redeem 34k. Clients request 400k.

**Devnet deployment:** program `2KXPBww71SmCwdh4MAZ8P8UdpkzmFx8eNFd1437Hbw8s`, slot 512178829, 413,752 bytes, SHA-256 `9639c8493e2d57cbdc3ea8683d68e489bf76901d32de83fe2134a81faeff4242`. Upgrade authority: the deploy wallet (devnet only). The public devnet RPC drops many upload transactions; `deploy-devnet.sh` now uses priority fees and 100 sign attempts, and accepts `RPC_URL`.

**Not done yet:**
- The 48-hour devnet soak with a watcher (§10, Layer 6).
- Rust-vs-TypeScript differential test (Layer 2), `cargo-fuzz` target (Layer 3), mutation testing (Layer 4).
- External audit and an immutable mainnet deploy (§11).
