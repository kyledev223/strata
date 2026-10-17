use super::*;
use proptest::prelude::*;

const SOL: u64 = 1_000_000_000;
const TOK: u64 = BASE_PER_TOKEN;

fn settings(rs: u16, rf: u16, cf: u16) -> Settings {
    Settings { reserve_share_bps: rs, fee_to_reserve_bps: rf, creator_fee_bps: cf }
}
const SPEC: Settings = Settings { reserve_share_bps: 2500, fee_to_reserve_bps: 100, creator_fee_bps: 50 };

/// The spec's base state: curve at 60 SOL / 100M tokens, given reserve and supply.
fn spec_pool(reserve_sol: u64, supply_tokens: u64) -> Pool {
    let mut p = Pool::new();
    p.v_sol = 60 * SOL;
    p.v_tokens = 100_000_000 * TOK;
    p.curve_lamports = p.v_sol - V_SOL_START;
    p.reserve = reserve_sol * SOL;
    p.supply = supply_tokens * TOK;
    p.record_hwm();
    p
}

fn settle(mut p: Pool) -> Pool {
    let until = p.drip_until_slot;
    release_drip(&mut p, until);
    p
}

/* --------------------------------------------- worked examples (spec §6.6) */

#[test]
fn w1_redemption_holds_floor() {
    let p = spec_pool(240, 600_000_000);
    let q = redeem(&p, 90_000_000 * TOK).unwrap();
    assert_eq!(q.payout, 36 * SOL);
    assert_eq!(q.after.reserve, 204 * SOL);
    assert_eq!(q.after.supply, 510_000_000 * TOK);
    assert_eq!(q.after.reserve as u128 * p.supply as u128, p.reserve as u128 * q.after.supply as u128);
    check(&p, &q.after).unwrap();
}

#[test]
fn w3_buy_share_path() {
    let p = spec_pool(60, 500_000_000);
    let q = buy(&p, &SPEC, 10 * SOL, 1_000).unwrap();
    assert!(!q.topped_up);
    assert_eq!(q.creator_fee, 50_000_000);
    assert_eq!(q.reserve_fee, 100_000_000);
    assert_eq!(q.to_curve, 7_387_500_000);
    assert_eq!(q.tokens_out, 10_962_715_637_173);
    assert_eq!(q.to_reserve_vault, 2_462_500_000 + 100_000_000);
    assert_eq!(q.to_reserve_now, 1_315_525_877); // backing at the floor, now
    check(&p, &q.after).unwrap();
    // After the drip, the reserve holds the whole share and fee, as in the spec.
    let s = settle(q.after);
    assert_eq!(s.reserve, 60 * SOL + 2_562_500_000);
}

#[test]
fn w4_buy_top_up_path() {
    let p = spec_pool(204, 510_000_000);
    let q = buy(&p, &SPEC, 10 * SOL, 1_000).unwrap();
    assert!(q.topped_up);
    assert_eq!(q.tokens_out, 9_280_384_277_500);
    assert_eq!(q.to_curve, 6_137_846_289);
    assert_eq!(q.to_reserve_vault - q.reserve_fee, 3_712_153_711);
    assert_eq!(q.to_reserve_now, 3_712_153_711); // deposit == required: no surplus but the fee
    assert_eq!(q.surplus, q.reserve_fee);
    check(&p, &q.after).unwrap();
}

#[test]
fn w5_routed_sell() {
    let p = spec_pool(204, 510_000_000);
    let q = sell(&p, &SPEC, 50_000_000 * TOK, true, 1_000).unwrap();
    assert_eq!(q.to_curve_tokens, 21_552_457_811_432);
    assert_eq!(q.gross, 10_638_595_812);
    assert_eq!(q.creator_fee, 53_192_979);
    assert_eq!(q.reserve_fee, 106_385_959);
    assert_eq!(q.curve_out, 10_479_016_874);
    // The reserve fee drips to remaining holders, so the redeem leg pays the pre-fee floor.
    let s_mid = p.supply - q.to_curve_tokens;
    let expect = (q.to_redeem_tokens as u128 * p.reserve as u128 / s_mid as u128) as u64;
    assert_eq!(q.redeem_out, expect);
    println!("W5 redeem_out = {} total = {}", q.redeem_out, q.curve_out + q.redeem_out);
    check(&p, &q.after).unwrap();
    // It still beats redeeming everything at the floor (20 SOL).
    assert!(q.curve_out + q.redeem_out > 20 * SOL);
}

#[test]
fn w6_rounding_favours_vault() {
    let mut p = Pool::new();
    p.reserve = 1_000_000_007;
    p.supply = 3_000_000_000;
    p.record_hwm();
    let q = redeem(&p, 1_000_000_000).unwrap();
    assert_eq!(q.payout, 333_333_335);
    assert_eq!(q.after.reserve, 666_666_672);
    check(&p, &q.after).unwrap();
}

#[test]
fn w7_zero_supply_then_buy_at_high_water_mark() {
    let p = spec_pool(240, 600_000_000);
    let all = redeem(&p, p.supply).unwrap();
    assert_eq!(all.payout, 240 * SOL);
    assert_eq!((all.after.reserve, all.after.supply), (0, 0));
    check(&p, &all.after).unwrap();
    let b = buy(&all.after, &SPEC, SOL, 1_000).unwrap();
    assert!(b.topped_up);
    assert_eq!(b.tokens_out, 979_190_230_000);
    assert_eq!(b.to_reserve_vault - b.reserve_fee, 391_676_092);
    check(&all.after, &b.after).unwrap();
}

#[test]
fn w8_dust_residual_is_rejected() {
    let p = spec_pool(240, 600_000_000);
    let q = redeem(&p, p.supply - 1).unwrap();
    assert_eq!(q.after.supply, 1);
    assert_eq!(q.after.reserve, 1); // one lamport behind one base unit: a 2,500x spike
    assert_eq!(check(&p, &q.after), Err(MathError::ResidualSupplyTooSmall));
}

#[test]
fn selling_entire_supply_pays_out_reserve() {
    // Tiny floor: the curve would take everything, but the last unit must redeem.
    let mut p = Pool::new();
    let b = buy(&p, &settings(500, 0, 0), 5 * SOL, 1).unwrap();
    p = b.after;
    let q = sell(&p, &settings(500, 0, 0), p.supply, true, 10).unwrap();
    assert!(q.to_redeem_tokens >= 1);
    assert_eq!((q.after.supply, q.after.reserve, q.after.pending), (0, 0, 0));
    check(&p, &q.after).unwrap();
}

#[test]
fn first_buy_sets_floor_immediately() {
    let p = Pool::new();
    let q = buy(&p, &SPEC, SOL, 1).unwrap();
    assert_eq!(q.surplus, 0);
    assert_eq!(q.after.pending, 0);
    assert!(q.after.reserve > 0);
    check(&p, &q.after).unwrap();
}

#[test]
fn errors() {
    let p = spec_pool(204, 510_000_000);
    assert_eq!(buy(&p, &SPEC, MIN_BUY_LAMPORTS - 1, 1), Err(MathError::BelowMinBuy));
    assert_eq!(redeem(&p, 0), Err(MathError::InvalidAmount));
    assert_eq!(redeem(&p, p.supply + 1), Err(MathError::InvalidAmount));
    assert_eq!(redeem(&p, 1), Err(MathError::DustRedemption));
    assert_eq!(sell(&p, &SPEC, 400_000_000 * TOK, false, 1), Err(MathError::RedemptionNotOpen));
    let mut full = p;
    full.v_tokens = V_TOKENS_MIN + 10;
    full.v_sol = (p.k() / full.v_tokens as u128) as u64 + 1;
    full.curve_lamports = full.v_sol - V_SOL_START;
    assert_eq!(buy(&full, &SPEC, 10 * SOL, 1), Err(MathError::CurveExhausted));
}

/* ------------------------------------------------------------ properties */

#[derive(Clone, Debug)]
enum Op {
    Buy(u64),
    Sell(u16),   // per-mille of supply
    Redeem(u16), // per-mille of supply
    SellAll,
    RedeemAll,
    Tick(u64),
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        4 => prop_oneof![1_000_000u64..20_000_000, 20_000_000u64..2 * SOL, 2 * SOL..200 * SOL].prop_map(Op::Buy),
        2 => (1u16..=1000).prop_map(Op::Sell),
        2 => (1u16..=1000).prop_map(Op::Redeem),
        1 => Just(Op::SellAll),
        1 => Just(Op::RedeemAll),
        2 => (1u64..400).prop_map(Op::Tick),
    ]
}

fn any_settings() -> impl Strategy<Value = Settings> {
    (RESERVE_SHARE_MIN_BPS..=RESERVE_SHARE_MAX_BPS, FEE_TO_RESERVE_MIN_BPS..=FEE_TO_RESERVE_MAX_BPS, CREATOR_FEE_MIN_BPS..=CREATOR_FEE_MAX_BPS)
        .prop_map(|(rs, rf, cf)| settings(rs, rf, cf))
}

/// Ledger of real lamports in each vault, to check accounting against the pool.
#[derive(Default, Debug)]
struct Vaults {
    reserve: u128,
    curve: u128,
    paid_in: u128,
    paid_out: u128,
    creator: u128,
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 2_000, ..ProptestConfig::default() })]

    /// P1, P2, P3, P4, P6, P8 over random operation sequences.
    #[test]
    fn invariants_hold(s in any_settings(), ops in proptest::collection::vec(op(), 1..120)) {
        let mut p = Pool::new();
        let mut v = Vaults::default();
        let mut slot = 1u64;
        for o in ops {
            release_drip(&mut p, slot);
            let before = p;
            // (after, reserve delta, curve delta, creator delta, paid in, paid out)
            type Step = (Pool, i128, i128, i128, i128, i128);
            let step: Result<Step, MathError> = match o {
                Op::Buy(l) => buy(&p, &s, l, slot).map(|q| {
                    (q.after, q.to_reserve_vault as i128, q.to_curve as i128, q.creator_fee as i128, l as i128, 0)
                }),
                Op::Sell(pm) | Op::Redeem(pm) if p.supply == 0 => { let _ = pm; continue; }
                Op::Sell(pm) => sell(&p, &s, (p.supply as u128 * pm as u128 / 1000).max(1) as u64, true, slot).map(|q| {
                    (q.after, q.reserve_fee as i128 - q.redeem_out as i128, -(q.gross as i128), q.creator_fee as i128, 0, (q.curve_out + q.redeem_out) as i128)
                }),
                Op::Redeem(pm) => redeem(&p, (p.supply as u128 * pm as u128 / 1000).max(1) as u64).map(|q| {
                    (q.after, -(q.payout as i128), 0, 0, 0, q.payout as i128)
                }),
                Op::SellAll if p.supply > 0 => sell(&p, &s, p.supply, true, slot).map(|q| {
                    (q.after, q.reserve_fee as i128 - q.redeem_out as i128, -(q.gross as i128), q.creator_fee as i128, 0, (q.curve_out + q.redeem_out) as i128)
                }),
                Op::RedeemAll if p.supply > 0 => redeem(&p, p.supply).map(|q| {
                    (q.after, -(q.payout as i128), 0, 0, 0, q.payout as i128)
                }),
                Op::SellAll | Op::RedeemAll => continue,
                Op::Tick(n) => { slot += n; continue; }
            };
            slot += 1;
            // The program rejects anything `check` rejects, and a rejected transaction moves nothing.
            if let Ok((after, dr, dc, dcr, pin, pout)) = step {
                if check(&before, &after).is_ok() {
                    if let Op::Buy(_) = o {
                        // P2: new tokens are backed at the floor (all of it counts when nothing circulated).
                        let gained = after.reserve as u128 + after.pending as u128 - before.reserve as u128 - before.pending as u128;
                        prop_assert!(before.supply == 0 || after.reserve - before.reserve >= backing(after.supply - before.supply, before.required_floor()).unwrap());
                        prop_assert!(gained > 0);
                    }
                    p = after;
                    v.reserve = (v.reserve as i128 + dr) as u128;
                    v.curve = (v.curve as i128 + dc) as u128;
                    v.creator = (v.creator as i128 + dcr) as u128;
                    v.paid_in = (v.paid_in as i128 + pin) as u128;
                    v.paid_out = (v.paid_out as i128 + pout) as u128;
                }
            }
            // I10 / I11 at the math level: vault balances equal what the pool says they hold.
            prop_assert_eq!(v.reserve, p.reserve as u128 + p.pending as u128);
            prop_assert_eq!(v.curve, p.curve_lamports as u128);
            // P3: every lamport paid in is in a vault or was paid out. Exactly.
            prop_assert_eq!(v.paid_out + v.creator + v.reserve + v.curve, v.paid_in);
            prop_assert!(p.supply == 0 || p.supply >= MIN_CIRCULATING_BASE);
            prop_assert!(p.supply != 0 || p.reserve == 0);
        }
    }

    /// P1 across drips and failed ops: the floor never drops, step by step.
    #[test]
    fn floor_never_decreases(s in any_settings(), ops in proptest::collection::vec(op(), 1..120)) {
        let mut p = Pool::new();
        let mut slot = 1u64;
        let mut last: Option<(u64, u64)> = None;
        for o in ops {
            release_drip(&mut p, slot);
            let next = match o {
                Op::Buy(l) => buy(&p, &s, l, slot).map(|q| q.after),
                Op::Sell(pm) if p.supply > 0 => sell(&p, &s, (p.supply as u128 * pm as u128 / 1000).max(1) as u64, true, slot).map(|q| q.after),
                Op::Redeem(pm) if p.supply > 0 => redeem(&p, (p.supply as u128 * pm as u128 / 1000).max(1) as u64).map(|q| q.after),
                Op::SellAll if p.supply > 0 => sell(&p, &s, p.supply, true, slot).map(|q| q.after),
                Op::RedeemAll if p.supply > 0 => redeem(&p, p.supply).map(|q| q.after),
                Op::Tick(n) => { slot += n; continue; }
                _ => continue,
            };
            slot += 1;
            if let Ok(a) = next { if check(&p, &a).is_ok() { p = a; } }
            if let Some(f) = p.required_floor() {
                if let Some((lr, ls)) = last {
                    prop_assert!(f.0 as u128 * ls as u128 >= lr as u128 * f.1 as u128, "floor dropped");
                }
                last = Some(f);
            }
        }
    }

    /// P5: one trader alone can't buy and exit with more SOL than they paid.
    #[test]
    fn no_free_lunch(s in any_settings(), l in 1_000_000u64..100 * SOL, ticks in 0u64..1000, by_redeem in any::<bool>()) {
        let p = Pool::new();
        let q = buy(&p, &s, l, 1).unwrap();
        let mut a = q.after;
        release_drip(&mut a, 1 + ticks);
        let out = if by_redeem {
            redeem(&a, a.supply).unwrap().payout
        } else {
            let x = sell(&a, &s, a.supply, true, 2 + ticks).unwrap();
            x.curve_out + x.redeem_out
        };
        prop_assert!(out <= l, "paid {} got {}", l, out);
    }

    /// P7: a routed sell pays at least a pure redemption of the same tokens.
    #[test]
    fn routed_sell_beats_redemption(s in any_settings(), l in 50_000_000u64..50 * SOL, pm in 1u16..999) {
        let q = buy(&Pool::new(), &s, l, 1).unwrap();
        let a = settle(q.after);
        let t = (a.supply as u128 * pm as u128 / 1000).max(1) as u64;
        if let (Ok(x), Ok(r)) = (sell(&a, &s, t, true, 500), redeem(&a, t)) {
            prop_assert!(x.curve_out + x.redeem_out >= r.payout);
        }
    }
}
