use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::common::*;
use crate::error::{OrStrata, StrataError};
use crate::events::{Trade, KIND_SELL};
use crate::state::*;

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, seeds = [LAUNCH_SEED, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut, seeds = [RESERVE_SEED, launch.key().as_ref()], bump = launch.reserve_bump)]
    pub reserve_vault: Box<Account<'info, Vault>>,

    #[account(mut, seeds = [CURVE_SEED, launch.key().as_ref()], bump = launch.curve_bump)]
    pub curve_vault: Box<Account<'info, Vault>>,

    #[account(mut, seeds = [CREATOR_FEES_SEED, launch.key().as_ref()], bump = launch.creator_fees_bump)]
    pub creator_fee_vault: Box<Account<'info, Vault>>,

    #[account(mut, token::mint = mint, token::authority = seller)]
    pub seller_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_sell(ctx: Context<Sell>, tokens_in: u64, min_lamports_out: u64) -> Result<()> {
    let a = ctx.accounts;
    let clock = Clock::get()?;
    let open = clock.unix_timestamp >= a.launch.redemption_opens_at;

    let mut pool = a.launch.math_pool();
    strata_math::release_drip(&mut pool, clock.slot);
    let before = pool;
    let q = strata_math::sell(&before, &a.launch.settings(), tokens_in, open, clock.slot).strata()?;
    let total = q.curve_out.checked_add(q.redeem_out).ok_or(StrataError::Overflow)?;
    require!(total >= min_lamports_out, StrataError::Slippage);

    token::burn(
        CpiContext::new(
            a.token_program.key(),
            Burn { mint: a.mint.to_account_info(), from: a.seller_token.to_account_info(), authority: a.seller.to_account_info() },
        ),
        tokens_in,
    )?;

    let seller = a.seller.to_account_info();
    let curve = a.curve_vault.to_account_info();
    let reserve = a.reserve_vault.to_account_info();
    // Curve leg: paid by the curve vault, fees split off in SOL (I6).
    pay_from_vault(&curve, &seller, q.curve_out)?;
    pay_from_vault(&curve, &a.creator_fee_vault.to_account_info(), q.creator_fee)?;
    pay_from_vault(&curve, &reserve, q.reserve_fee)?;
    // Redemption leg: the only other way SOL leaves the reserve (I5).
    pay_from_reserve(&reserve, &seller, q.redeem_out)?;

    a.launch.pool = q.after.into();
    enforce(&before, &q.after, &mut a.mint, &reserve, &curve)?;

    let launch = &mut a.launch;
    if floor_rose(&before, &q.after) {
        launch.floor_raises += 1;
    }
    launch.creator_fees_total = launch.creator_fees_total.saturating_add(q.creator_fee);
    launch.fees_to_reserve = launch.fees_to_reserve.saturating_add(q.reserve_fee);
    launch.redeemed_base = launch.redeemed_base.saturating_add(q.to_redeem_tokens);
    launch.redeemed_lamports = launch.redeemed_lamports.saturating_add(q.redeem_out);
    launch.volume_total = launch.volume_total.saturating_add(total);
    launch.trades += 1;
    record(launch, clock.unix_timestamp, total);

    emit!(Trade {
        launch: launch.key(),
        mint: launch.mint,
        user: seller.key(),
        kind: KIND_SELL,
        lamports: total,
        tokens: tokens_in,
        redeemed_tokens: q.to_redeem_tokens,
        price_per_m: q.after.price_per_m(),
        floor_per_m: q.after.floor_per_m(),
        reserve: q.after.reserve,
        supply: q.after.supply,
        ts: clock.unix_timestamp,
    });
    Ok(())
}
