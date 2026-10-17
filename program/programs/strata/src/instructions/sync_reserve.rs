use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::common::{enforce, vault_rent};
use crate::error::OrStrata;
use crate::state::*;

/// Permissionless. Lamports sent straight to the reserve vault (donations) are
/// untracked until this folds them into the drip. A no-op at zero supply (A9).
#[derive(Accounts)]
pub struct SyncReserve<'info> {
    #[account(mut, seeds = [LAUNCH_SEED, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(seeds = [RESERVE_SEED, launch.key().as_ref()], bump = launch.reserve_bump)]
    pub reserve_vault: Box<Account<'info, Vault>>,

    #[account(seeds = [CURVE_SEED, launch.key().as_ref()], bump = launch.curve_bump)]
    pub curve_vault: Box<Account<'info, Vault>>,
}

pub fn handle_sync_reserve(ctx: Context<SyncReserve>) -> Result<()> {
    let a = ctx.accounts;
    let slot = Clock::get()?.slot;
    let mut pool = a.launch.math_pool();
    strata_math::release_drip(&mut pool, slot);
    let before = pool;
    let mut after = pool;
    if after.supply > 0 {
        let held = a.reserve_vault.to_account_info().lamports();
        let tracked = after.reserve + after.pending + vault_rent()?;
        let untracked = held.saturating_sub(tracked);
        strata_math::add_surplus(&mut after, untracked, slot).strata()?;
    }
    a.launch.pool = after.into();
    enforce(&before, &after, &mut a.mint, &a.reserve_vault.to_account_info(), &a.curve_vault.to_account_info())
}
