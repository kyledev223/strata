//! Shared plumbing: lamport moves, invariant enforcement and stats.

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::Mint;
use strata_math::Pool;

use crate::error::{OrStrata, StrataError};
use crate::state::*;

/// Rent-exempt minimum of an 8-byte `Vault`.
pub fn vault_rent() -> Result<u64> {
    Ok(Rent::get()?.minimum_balance(8 + Vault::INIT_SPACE))
}

/// Move lamports from a wallet (a signer owned by the system program).
pub fn pay_from_wallet<'info>(from: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    system_program::transfer(
        CpiContext::new(system_program::ID, system_program::Transfer { from: from.clone(), to: to.clone() }),
        amount,
    )
}

/// Move lamports out of a program-owned vault. Never used for the reserve
/// vault: that goes through `pay_from_reserve` (I5).
pub fn pay_from_vault<'info>(vault: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    vault.sub_lamports(amount)?;
    to.add_lamports(amount)?;
    Ok(())
}

/// The only debit path from the reserve vault: redemption payouts (I5).
pub fn pay_from_reserve<'info>(reserve_vault: &AccountInfo<'info>, to: &AccountInfo<'info>, amount: u64) -> Result<()> {
    pay_from_vault(reserve_vault, to, amount)
}

/// Every invariant, checked at the end of every state-changing instruction.
/// I4, I7, I8, I11 (math) + I9 mint supply + I10/I11 real vault balances.
pub fn enforce<'info>(
    before: &Pool,
    after: &Pool,
    mint: &mut Account<'info, Mint>,
    reserve_vault: &AccountInfo<'info>,
    curve_vault: &AccountInfo<'info>,
) -> Result<()> {
    strata_math::check(before, after).strata()?;

    mint.reload()?;
    require!(mint.supply == after.supply, StrataError::SupplyMismatch);

    let rent = vault_rent()?;
    let owed_reserve = (after.reserve as u128) + (after.pending as u128) + rent as u128;
    require!(reserve_vault.lamports() as u128 >= owed_reserve, StrataError::VaultUnderfunded);
    let owed_curve = (after.curve_lamports as u128) + rent as u128;
    require!(curve_vault.lamports() as u128 >= owed_curve, StrataError::CurveInsolvent);
    Ok(())
}

/// Count a floor raise (strict increase) for the lifetime stat.
pub fn floor_rose(before: &Pool, after: &Pool) -> bool {
    match (before.required_floor(), after.supply) {
        (Some((rb, sb)), s) if s > 0 => (after.reserve as u128) * (sb as u128) > (rb as u128) * (s as u128),
        _ => false,
    }
}

/// Roll the hourly and daily rings forward to `now` and record a trade.
pub fn record(launch: &mut Launch, now: i64, volume: u64) {
    let pool: Pool = launch.pool.into();
    let close = Bucket { price_per_m: pool.price_per_m(), floor_per_m: pool.floor_per_m(), volume: 0 };
    roll(&mut launch.hourly, &mut launch.hour_index, now / 3600, close, volume);
    roll(&mut launch.daily, &mut launch.day_index, now / 86_400, close, volume);
}

fn roll<const N: usize>(ring: &mut [Bucket; N], index: &mut i64, current: i64, close: Bucket, volume: u64) {
    let n = N as i64;
    if *index == 0 {
        // First trade: every bucket starts at the current close.
        for b in ring.iter_mut() {
            *b = close;
        }
        *index = current;
    } else if current > *index {
        let prev = ring[(*index).rem_euclid(n) as usize];
        let gap = (current - *index).min(n);
        for i in 1..=gap {
            let h = (current - gap + i).rem_euclid(n) as usize;
            ring[h] = Bucket { price_per_m: prev.price_per_m, floor_per_m: prev.floor_per_m, volume: 0 };
        }
        *index = current;
    }
    let b = &mut ring[current.rem_euclid(n) as usize];
    b.price_per_m = close.price_per_m;
    b.floor_per_m = close.floor_per_m;
    b.volume = b.volume.saturating_add(volume);
}
