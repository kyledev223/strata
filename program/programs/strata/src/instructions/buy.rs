use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::common::*;
use crate::error::{OrStrata, StrataError};
use crate::events::{Trade, KIND_BUY};
use crate::state::*;

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

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

    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy(ctx: Context<Buy>, lamports_in: u64, min_tokens_out: u64) -> Result<()> {
    let a = ctx.accounts;
    execute_buy(
        &mut a.launch,
        &mut a.mint,
        &a.buyer.to_account_info(),
        &a.buyer_token.to_account_info(),
        &a.reserve_vault.to_account_info(),
        &a.curve_vault.to_account_info(),
        &a.creator_fee_vault.to_account_info(),
        a.token_program.key(),
        lamports_in,
        min_tokens_out,
    )
    .map(|_| ())
}

/// The buy logic shared by `buy` and `creator_buy`. Returns tokens minted.
#[allow(clippy::too_many_arguments)]
pub fn execute_buy<'info>(
    launch: &mut Account<'info, Launch>,
    mint: &mut Account<'info, Mint>,
    payer: &AccountInfo<'info>,
    recipient: &AccountInfo<'info>,
    reserve_vault: &AccountInfo<'info>,
    curve_vault: &AccountInfo<'info>,
    creator_fee_vault: &AccountInfo<'info>,
    token_program: Pubkey,
    lamports_in: u64,
    min_tokens_out: u64,
) -> Result<u64> {
    let clock = Clock::get()?;
    let mut pool = launch.math_pool();
    strata_math::release_drip(&mut pool, clock.slot);
    let before = pool;

    let q = strata_math::buy(&before, &launch.settings(), lamports_in, clock.slot).strata()?;
    require!(q.tokens_out >= min_tokens_out, StrataError::Slippage);

    pay_from_wallet(payer, reserve_vault, q.to_reserve_vault)?;
    pay_from_wallet(payer, curve_vault, q.to_curve)?;
    pay_from_wallet(payer, creator_fee_vault, q.creator_fee)?;

    let mint_key = launch.mint;
    let bump = [launch.bump];
    let seeds: &[&[u8]] = &[LAUNCH_SEED, mint_key.as_ref(), &bump];
    token::mint_to(
        CpiContext::new_with_signer(
            token_program,
            MintTo { mint: mint.to_account_info(), to: recipient.clone(), authority: launch.to_account_info() },
            &[seeds],
        ),
        q.tokens_out,
    )?;

    launch.pool = q.after.into();
    enforce(&before, &q.after, mint, reserve_vault, curve_vault)?;

    if floor_rose(&before, &q.after) {
        launch.floor_raises += 1;
    }
    launch.creator_fees_total = launch.creator_fees_total.saturating_add(q.creator_fee);
    launch.fees_to_reserve = launch.fees_to_reserve.saturating_add(q.reserve_fee);
    launch.volume_total = launch.volume_total.saturating_add(lamports_in);
    launch.trades += 1;
    record(launch, clock.unix_timestamp, lamports_in);

    emit!(Trade {
        launch: launch.key(),
        mint: mint_key,
        user: payer.key(),
        kind: KIND_BUY,
        lamports: lamports_in,
        tokens: q.tokens_out,
        redeemed_tokens: 0,
        price_per_m: q.after.price_per_m(),
        floor_per_m: q.after.floor_per_m(),
        reserve: q.after.reserve,
        supply: q.after.supply,
        ts: clock.unix_timestamp,
    });
    Ok(q.tokens_out)
}
