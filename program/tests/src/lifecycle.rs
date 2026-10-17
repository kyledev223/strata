use crate::harness::*;
use solana_signer::Signer;
use strata::error::StrataError;

#[test]
fn full_lifecycle_with_vesting() {
    let mut env = Env::new();
    let creator = env.wallet(100);
    let o = Opts { vesting_days: 10, ..Opts::default() };
    let treasury_before = env.lamports(&treasury());
    let mint = launch(&mut env, &creator, &o, 2 * SOL);
    let mut last = None;
    assert_chain_invariants(&env, &mint, &mut last);

    // Launch fee went to the treasury; metadata exists.
    assert_eq!(env.lamports(&treasury()) - treasury_before, strata_math::limits::LAUNCH_FEE_LAMPORTS);
    assert!(env.svm.get_account(&pdas(mint).metadata).is_some(), "metadata created");

    // First buy is in escrow, not the creator's wallet.
    let l = env.launch(&mint);
    assert!(l.first_buy_done && l.vest_total > 0);
    assert_eq!(env.token_balance(&creator.pubkey(), &mint), 0);

    // Several buyers.
    let users: Vec<_> = (0..4).map(|_| env.wallet(200)).collect();
    for (i, u) in users.iter().enumerate() {
        let r = buy(&mut env, u, &mint, (i as u64 + 1) * 3 * SOL);
        assert!(r.is_ok(), "{:?}", r.err().map(|e| e.meta.logs));
        assert_chain_invariants(&env, &mint, &mut last);
    }

    // Drip: surplus released over time raises the floor.
    let before = env.launch(&mint).pool;
    assert!(before.pending > 0);
    env.warp(120, 200);
    let tiny = env.wallet(5);
    buy(&mut env, &tiny, &mint, SOL / 100).unwrap();
    assert!(env.launch(&mint).pool.reserve > before.reserve);
    assert_chain_invariants(&env, &mint, &mut last);

    // Partial sell (curve leg), then a big sell that routes into redemption.
    let u0 = &users[0];
    let bal = env.token_balance(&u0.pubkey(), &mint);
    let sol_before = env.lamports(&u0.pubkey());
    env.send(&[ix_sell(&u0.pubkey(), &mint, bal / 4, 0)], u0, &[]).unwrap();
    assert!(env.lamports(&u0.pubkey()) > sol_before);
    assert_chain_invariants(&env, &mint, &mut last);

    let u3 = &users[3];
    let bal = env.token_balance(&u3.pubkey(), &mint);
    let r = env.send(&[ix_sell(&u3.pubkey(), &mint, bal, 0)], u3, &[]).unwrap();
    println!("routed sell CU: {}", r.compute_units_consumed);
    assert_chain_invariants(&env, &mint, &mut last);

    // Redeem at the floor.
    let u1 = &users[1];
    let bal = env.token_balance(&u1.pubkey(), &mint);
    let l = env.launch(&mint).pool;
    let expect = (bal as u128 * l.reserve as u128 / l.supply as u128) as u64;
    let sol_before = env.lamports(&u1.pubkey());
    let r = env.send(&[ix_redeem(&u1.pubkey(), &mint, bal, expect)], u1, &[]).unwrap();
    println!("redeem CU: {}", r.compute_units_consumed);
    assert!(env.lamports(&u1.pubkey()) - sol_before >= expect - 10_000, "paid at the floor, minus the tx fee");
    assert_chain_invariants(&env, &mint, &mut last);

    // Creator fees are claimable and never came from the reserve.
    let fees = env.lamports(&pdas(mint).fees) - env.vault_rent();
    assert!(fees > 0);
    let c_before = env.lamports(&creator.pubkey());
    env.send(&[ix_claim_fees(&creator.pubkey(), &mint)], &creator, &[]).unwrap();
    assert!(env.lamports(&creator.pubkey()) + 10_000 > c_before + fees);
    assert_chain_invariants(&env, &mint, &mut last);

    // Vesting: half after 5 days, all after 10.
    env.send(&[ix_create_ata(&creator.pubkey(), &creator.pubkey(), &mint)], &creator, &[]).unwrap();
    env.warp(5 * 86_400, 1_000);
    env.send(&[ix_claim_vested(&creator.pubkey(), &mint)], &creator, &[]).unwrap();
    let half = env.token_balance(&creator.pubkey(), &mint);
    let total = env.launch(&mint).vest_total;
    assert!(half >= total / 2 - total / 1000 && half <= total / 2 + total / 1000, "half vested: {half} of {total}");
    env.warp(6 * 86_400, 1_000);
    env.send(&[ix_claim_vested(&creator.pubkey(), &mint)], &creator, &[]).unwrap();
    assert_eq!(env.token_balance(&creator.pubkey(), &mint), total);
    let r = env.send(&[ix_claim_vested(&creator.pubkey(), &mint)], &creator, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::NothingToClaim)));
    assert_chain_invariants(&env, &mint, &mut last);
}

#[test]
fn everyone_exits_reserve_ends_at_zero() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let users: Vec<_> = (0..3).map(|_| env.wallet(50)).collect();
    for u in &users {
        buy(&mut env, u, &mint, 4 * SOL).unwrap();
    }
    let mut last = None;
    env.warp(600, 500);
    // Everyone redeems everything; the last redemption collects the whole reserve.
    let mut holders = users.iter().collect::<Vec<_>>();
    holders.push(&creator);
    for h in holders {
        let bal = env.token_balance(&h.pubkey(), &mint);
        if bal > 0 {
            let r = env.send(&[ix_redeem(&h.pubkey(), &mint, bal, 0)], h, &[]);
            assert!(r.is_ok(), "{:?}", r.err().map(|e| e.meta.logs));
            assert_chain_invariants(&env, &mint, &mut last);
        }
    }
    let l = env.launch(&mint).pool;
    assert_eq!((l.supply, l.reserve, l.pending), (0, 0, 0));
    assert_eq!(env.lamports(&pdas(mint).reserve), env.vault_rent(), "nothing orphaned in the vault");

    // A new buyer backs new tokens at the high-water mark.
    let late = env.wallet(10);
    buy(&mut env, &late, &mint, SOL).unwrap();
    assert_chain_invariants(&env, &mint, &mut last);
}

#[test]
fn dust_residual_is_rejected_on_chain() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let bal = env.token_balance(&creator.pubkey(), &mint);
    let r = env.send(&[ix_redeem(&creator.pubkey(), &mint, bal - 1, 0)], &creator, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::ResidualSupplyTooSmall)));
    // Redeeming all of it works.
    env.send(&[ix_redeem(&creator.pubkey(), &mint, bal, 0)], &creator, &[]).unwrap();
}

#[test]
fn compute_budget() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = Keypair::new();
    let o = Opts::default();
    let r = env
        .send(
            &[
                ix_initialize(&creator.pubkey(), &mint.pubkey(), &o, "Budget", "BDGT"),
                ix_create_ata(&creator.pubkey(), &creator.pubkey(), &mint.pubkey()),
                ix_creator_buy(&creator.pubkey(), &mint.pubkey(), SOL, 0),
            ],
            &creator,
            &[&mint],
        )
        .unwrap();
    println!("initialize + first buy CU: {}", r.compute_units_consumed);
    let u = env.wallet(50);
    // A top-up buy (price near floor) exercises the bisection: worst case.
    let r = buy(&mut env, &u, &mint.pubkey(), 7 * SOL).unwrap();
    println!("buy CU: {}", r.compute_units_consumed);
    assert!(r.compute_units_consumed < 200_000);
}

use solana_keypair::Keypair;
