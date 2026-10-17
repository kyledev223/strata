//! Stateful fuzz (PROGRAM_SPEC.md §10, layer 5): random instruction sequences from
//! many wallets against the real program, invariants re-checked from chain state
//! after every transaction, successful or not.

use crate::harness::*;
use solana_keypair::Keypair;
use solana_signer::Signer;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n.max(1)
    }
}

fn run(seed: u64, steps: usize) -> (usize, usize) {
    let mut rng = Rng(seed);
    let mut env = Env::new();
    let creator = env.wallet(500);
    let o = Opts {
        reserve_share_bps: 500 + rng.below(5_501) as u16,
        fee_to_reserve_bps: rng.below(201) as u16,
        creator_fee_bps: rng.below(201) as u16,
        vesting_days: 0,
        delay_hours: 0,
    };
    let mint = launch(&mut env, &creator, &o, (1 + rng.below(5)) * SOL);
    let wallets: Vec<Keypair> = (0..6).map(|_| env.wallet(2_000)).collect();
    for w in &wallets {
        env.send(&[ix_create_ata(&w.pubkey(), &w.pubkey(), &mint)], w, &[]).unwrap();
    }
    let mut last = None;
    let (mut ok, mut failed) = (0, 0);
    for _ in 0..steps {
        let w = &wallets[rng.below(wallets.len() as u64) as usize];
        let bal = env.token_balance(&w.pubkey(), &mint);
        let r = match rng.below(10) {
            0..=3 => {
                let lamports = match rng.below(3) {
                    0 => 1_000_000 + rng.below(10_000_000),
                    1 => SOL / 10 + rng.below(5 * SOL),
                    _ => 5 * SOL + rng.below(80 * SOL),
                };
                env.send(&[ix_buy(&w.pubkey(), &mint, lamports, 0)], w, &[])
            }
            4..=5 if bal > 0 => {
                let t = if rng.below(5) == 0 { bal } else { (bal as u128 * (1 + rng.below(999)) as u128 / 1000) as u64 };
                env.send(&[ix_sell(&w.pubkey(), &mint, t.max(1), 0)], w, &[])
            }
            6..=7 if bal > 0 => {
                let t = if rng.below(4) == 0 { bal } else { (bal as u128 * (1 + rng.below(999)) as u128 / 1000) as u64 };
                env.send(&[ix_redeem(&w.pubkey(), &mint, t.max(1), 0)], w, &[])
            }
            8 => {
                env.warp(rng.below(300) as i64, rng.below(400));
                continue;
            }
            _ => env.send(&[ix_sync(&mint)], w, &[]),
        };
        if r.is_ok() { ok += 1 } else { failed += 1 }
        assert_chain_invariants(&env, &mint, &mut last);
    }
    (ok, failed)
}

#[test]
fn stateful_fuzz() {
    let seeds: u64 = std::env::var("FUZZ_SEEDS").ok().and_then(|s| s.parse().ok()).unwrap_or(8);
    let steps: usize = std::env::var("FUZZ_STEPS").ok().and_then(|s| s.parse().ok()).unwrap_or(250);
    let (mut ok, mut failed) = (0, 0);
    for s in 0..seeds {
        let (o, f) = run(0x9E37_79B9_7F4A_7C15 ^ (s + 1).wrapping_mul(0xD1B5_4A32_D192_ED03), steps);
        ok += o;
        failed += f;
    }
    println!("stateful fuzz: {seeds} launches x {steps} steps, {ok} txs accepted, {failed} rejected, invariants held after every one");
    assert!(ok > failed, "most random transactions should be valid");
}
