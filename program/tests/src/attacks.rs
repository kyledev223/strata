use crate::harness::*;
use anchor_lang::prelude::Pubkey;
use solana_keypair::Keypair;
use solana_signer::Signer;
use strata::error::StrataError;

#[test]
fn redemption_delay_is_enforced() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts { delay_hours: 24, ..Opts::default() }, SOL);
    let bal = env.token_balance(&creator.pubkey(), &mint);
    let r = env.send(&[ix_redeem(&creator.pubkey(), &mint, bal / 2, 0)], &creator, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::RedemptionNotOpen)));
    env.warp(24 * 3600, 10);
    env.send(&[ix_redeem(&creator.pubkey(), &mint, bal / 2, 0)], &creator, &[]).unwrap();
}

#[test]
fn slippage_limits() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let u = env.wallet(50);
    let r = env.send(&[ix_create_ata(&u.pubkey(), &u.pubkey(), &mint), ix_buy(&u.pubkey(), &mint, SOL, u64::MAX)], &u, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::Slippage)));
    let r = env.send(&[ix_redeem(&creator.pubkey(), &mint, 1_000 * TOK, u64::MAX)], &creator, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::Slippage)));
}

#[test]
fn first_buy_only_once_and_only_by_creator() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let r = env.send(&[ix_creator_buy(&creator.pubkey(), &mint, SOL, 0)], &creator, &[]);
    assert_eq!(error_code(&r), Some(code(StrataError::FirstBuyUnavailable)));

    // Someone else can't call creator_buy on a fresh launch.
    let creator2 = env.wallet(50);
    let mint2 = launch(&mut env, &creator2, &Opts::default(), 0);
    let mallory = env.wallet(50);
    let r = env.send(
        &[ix_create_ata(&mallory.pubkey(), &mallory.pubkey(), &mint2), {
            let mut ix = ix_creator_buy(&mallory.pubkey(), &mint2, SOL, 0);
            ix.accounts[0].pubkey = mallory.pubkey();
            ix
        }],
        &mallory,
        &[],
    );
    assert!(r.is_err(), "has_one = creator rejects a stranger");
}

#[test]
fn invalid_settings_rejected() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    for (o, err) in [
        (Opts { reserve_share_bps: 100, ..Opts::default() }, StrataError::InvalidSetting),
        (Opts { reserve_share_bps: 9000, ..Opts::default() }, StrataError::InvalidSetting),
        (Opts { creator_fee_bps: 500, ..Opts::default() }, StrataError::InvalidSetting),
        (Opts { vesting_days: 400, ..Opts::default() }, StrataError::InvalidSetting),
        (Opts { delay_hours: 5, ..Opts::default() }, StrataError::InvalidDelay),
    ] {
        let mint = Keypair::new();
        let r = env.send(&[ix_initialize(&creator.pubkey(), &mint.pubkey(), &o, "X", "XX")], &creator, &[&mint]);
        assert_eq!(error_code(&r), Some(code(err)), "{o:?}");
    }
    let mint = Keypair::new();
    let r = env.send(&[ix_initialize(&creator.pubkey(), &mint.pubkey(), &Opts::default(), "X", "bad!")], &creator, &[&mint]);
    assert_eq!(error_code(&r), Some(code(StrataError::InvalidTicker)));
}

#[test]
fn account_substitution_rejected() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint_a = launch(&mut env, &creator, &Opts::default(), SOL);
    let mint_b = launch(&mut env, &creator, &Opts::default(), SOL);
    let u = env.wallet(50);
    env.send(&[ix_create_ata(&u.pubkey(), &u.pubkey(), &mint_a)], &u, &[]).unwrap();

    // Launch A's accounts with launch B's reserve vault.
    let mut ix = ix_buy(&u.pubkey(), &mint_a, SOL, 0);
    ix.accounts[3].pubkey = pdas(mint_b).reserve;
    assert!(env.send(&[ix], &u, &[]).is_err(), "foreign vault");

    // A fake treasury.
    let mint = Keypair::new();
    let mut ix = ix_initialize(&creator.pubkey(), &mint.pubkey(), &Opts::default(), "X", "XX");
    ix.accounts[7].pubkey = Pubkey::new_unique();
    assert!(env.send(&[ix], &creator, &[&mint]).is_err(), "treasury address is fixed");

    // Redeeming against launch B's reserve with launch A's tokens.
    let mut ix = ix_redeem(&creator.pubkey(), &mint_a, 1_000 * TOK, 0);
    ix.accounts[3].pubkey = pdas(mint_b).reserve;
    assert!(env.send(&[ix], &creator, &[]).is_err(), "reserve vault seeds bind it to the launch");
}

/// A2: front-run a large buy, redeem right after, in consecutive slots.
/// The curve caps total buys (~550 SOL to sell out 1B tokens), so the largest
/// possible "whale" is a few hundred SOL. With the drip the attacker can't
/// collect the whale's surplus before redeeming.
#[test]
fn jit_floor_capture_is_unprofitable_with_drip() {
    for (first, atk, whale_sol) in [(SOL / 2, 10 * SOL, 300 * SOL), (SOL, 50 * SOL, 400 * SOL), (2 * SOL, SOL, 150 * SOL)] {
        let mut env = Env::new();
        let creator = env.wallet(10);
        let mint = launch(&mut env, &creator, &Opts::default(), first);
        let attacker = env.wallet(200);
        let whale = env.wallet(1_000);
        let a_before = env.lamports(&attacker.pubkey());

        buy(&mut env, &attacker, &mint, atk).unwrap();
        env.warp(1, 1);
        let r = buy(&mut env, &whale, &mint, whale_sol);
        assert!(r.is_ok(), "whale buy: {:?}", r.err().map(|e| e.meta.logs));
        env.warp(1, 1);
        let bal = env.token_balance(&attacker.pubkey(), &mint);
        env.send(&[ix_redeem(&attacker.pubkey(), &mint, bal, 0)], &attacker, &[]).unwrap();
        let pnl = env.lamports(&attacker.pubkey()) as i128 - a_before as i128;
        println!("JIT: first buy {} SOL, attacker {} SOL, whale {} SOL -> attacker PnL {:.4} SOL", first as f64 / 1e9, atk / SOL, whale_sol / SOL, pnl as f64 / 1e9);
        assert!(pnl < 0, "front-run + immediate redeem must lose money");
    }
}

#[test]
fn donations_only_raise_the_floor_and_wait_for_supply() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let mut last = None;
    assert_chain_invariants(&env, &mint, &mut last);
    let donor = env.wallet(20);
    env.svm.airdrop(&pdas(mint).reserve, 10 * SOL).unwrap();
    let before = env.launch(&mint).pool;
    env.send(&[ix_sync(&mint)], &donor, &[]).unwrap();
    let after = env.launch(&mint).pool;
    assert_eq!(after.pending, before.pending + 10 * SOL);
    env.warp(120, 200);
    env.send(&[ix_sync(&mint)], &donor, &[]).unwrap();
    assert!(env.launch(&mint).pool.reserve >= before.reserve + 10 * SOL);
    assert_chain_invariants(&env, &mint, &mut last);
}

#[test]
fn reserve_vault_cannot_be_drained_by_anyone_else() {
    let mut env = Env::new();
    let creator = env.wallet(50);
    let mint = launch(&mut env, &creator, &Opts::default(), SOL);
    let vault = pdas(mint).reserve;
    // Program-owned: the system program can never move its lamports, signed or not.
    assert_eq!(env.svm.get_account(&vault).unwrap().owner, strata::ID);
    // A transfer naming the vault without its signature (nobody can sign for a PDA) fails.
    let thief = env.wallet(1);
    let mut ix = anchor_lang::solana_program::system_instruction::transfer(&vault, &thief.pubkey(), SOL / 2);
    ix.accounts[0].is_signer = false;
    let before = env.lamports(&vault);
    assert!(env.send(&[ix], &thief, &[]).is_err());
    assert_eq!(env.lamports(&vault), before);
}
