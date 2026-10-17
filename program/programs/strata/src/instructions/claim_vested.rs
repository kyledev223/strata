use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::StrataError;
use crate::state::*;

#[derive(Accounts)]
pub struct ClaimVested<'info> {
    pub creator: Signer<'info>,

    #[account(mut, seeds = [LAUNCH_SEED, mint.key().as_ref()], bump = launch.bump, has_one = mint, has_one = creator)]
    pub launch: Box<Account<'info, Launch>>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(mut, seeds = [VEST_SEED, launch.key().as_ref()], bump, token::mint = mint, token::authority = launch)]
    pub vest_escrow: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = creator)]
    pub creator_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handle_claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
    let a = ctx.accounts;
    require!(a.launch.vesting_days > 0 && a.launch.vest_total > 0, StrataError::VestingNotEnabled);
    let now = Clock::get()?.unix_timestamp;
    let duration = a.launch.vesting_days as i64 * 86_400;
    let elapsed = (now - a.launch.vest_start).clamp(0, duration);
    let vested = (a.launch.vest_total as u128 * elapsed as u128 / duration as u128) as u64;
    let claimable = vested.saturating_sub(a.launch.vest_claimed);
    require!(claimable > 0, StrataError::NothingToClaim);

    let mint_key = a.launch.mint;
    let bump = [a.launch.bump];
    let seeds: &[&[u8]] = &[LAUNCH_SEED, mint_key.as_ref(), &bump];
    token::transfer(
        CpiContext::new_with_signer(
            a.token_program.key(),
            Transfer {
                from: a.vest_escrow.to_account_info(),
                to: a.creator_token.to_account_info(),
                authority: a.launch.to_account_info(),
            },
            &[seeds],
        ),
        claimable,
    )?;
    a.launch.vest_claimed += claimable;
    Ok(())
}
