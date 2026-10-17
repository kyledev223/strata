use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::common::*;
use crate::error::{OrStrata, StrataError};
use crate::events::{Trade, KIND_REDEEM};
use crate::state::*;

#[derive(Accounts)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(mut, seeds = [LAUNCH_SEED, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut, seeds = [RESERVE_SEED, launch.key().as_ref()], bump = launch.reserve_bump)]
    pub reserve_vault: Box<Account<'info, Vault>>,

    #[account(seeds = [CURVE_SEED, launch.key().as_ref()], bump = launch.curve_bump)]
    pub curve_vault: Box<Account<'info, Vault>>,

    #[account(mut, token::mint = mint, token::authority = holder)]
    pub holder_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_redeem(ctx: Context<Redeem>, tokens: u64, min_lamports_out: u64) -> Result<()> {
    let a = ctx.accounts;
    let clock = Clock::get()?;
    require!(clock.unix_timestamp >= a.launch.redemption_opens_at, StrataError::RedemptionNotOpen);

    let mut pool = a.launch.math_pool();
    strata_math::release_drip(&mut pool, clock.slot);
    let before = pool;
    let q = strata_math::redeem(&before, tokens).strata()?;
    require!(q.payout >= min_lamports_out, StrataError::Slippage);

    token::burn(
        CpiContext::new(
            a.token_program.key(),
            Burn { mint: a.mint.to_account_info(), from: a.holder_token.to_account_info(), authority: a.holder.to_account_info() },
        ),
        tokens,
    )?;

    let reserve = a.reserve_vault.to_account_info();
    let holder = a.holder.to_account_info();
    pay_from_reserve(&reserve, &holder, q.payout)?;

    a.launch.pool = q.after.into();
    enforce(&before, &q.after, &mut a.mint, &reserve, &a.curve_vault.to_account_info())?;

    let launch = &mut a.launch;
    if floor_rose(&before, &q.after) {
        launch.floor_raises += 1;
    }
    launch.redeemed_base = launch.redeemed_base.saturating_add(tokens);
    launch.redeemed_lamports = launch.redeemed_lamports.saturating_add(q.payout);
    launch.volume_total = launch.volume_total.saturating_add(q.payout);
    launch.trades += 1;
    record(launch, clock.unix_timestamp, q.payout);

    emit!(Trade {
        launch: launch.key(),
        mint: launch.mint,
        user: holder.key(),
        kind: KIND_REDEEM,
        lamports: q.payout,
        tokens,
        redeemed_tokens: tokens,
        price_per_m: q.after.price_per_m(),
        floor_per_m: q.after.floor_per_m(),
        reserve: q.after.reserve,
        supply: q.after.supply,
        ts: clock.unix_timestamp,
    });
    Ok(())
}
