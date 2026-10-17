use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, InitializeAccount3, Mint, Token, TokenAccount};
use strata_math::limits::FIRST_BUY_MAX_LAMPORTS;

use super::buy::execute_buy;
use crate::error::StrataError;
use crate::state::*;

const TOKEN_ACCOUNT_SPACE: u64 = 165;

/// The creator's one-time first buy, allowed only while nothing circulates.
/// Usually sent in the same transaction as `initialize_launch`.
#[derive(Accounts)]
pub struct CreatorBuy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut, seeds = [LAUNCH_SEED, mint.key().as_ref()], bump = launch.bump, has_one = mint, has_one = creator)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(mut, seeds = [RESERVE_SEED, launch.key().as_ref()], bump = launch.reserve_bump)]
    pub reserve_vault: Box<Account<'info, Vault>>,

    #[account(mut, seeds = [CURVE_SEED, launch.key().as_ref()], bump = launch.curve_bump)]
    pub curve_vault: Box<Account<'info, Vault>>,

    #[account(mut, seeds = [CREATOR_FEES_SEED, launch.key().as_ref()], bump = launch.creator_fees_bump)]
    pub creator_fee_vault: Box<Account<'info, Vault>>,

    /// Receives the tokens when the launch has no vesting.
    #[account(mut, token::mint = mint, token::authority = creator)]
    pub creator_token: Box<Account<'info, TokenAccount>>,

    /// CHECK: the vesting escrow PDA; created here as a token account owned by the launch when vesting is on.
    #[account(mut, seeds = [VEST_SEED, launch.key().as_ref()], bump)]
    pub vest_escrow: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_creator_buy(ctx: Context<CreatorBuy>, lamports_in: u64, min_tokens_out: u64) -> Result<()> {
    let a = ctx.accounts;
    require!(!a.launch.first_buy_done && a.launch.pool.supply == 0, StrataError::FirstBuyUnavailable);
    require!(lamports_in <= FIRST_BUY_MAX_LAMPORTS, StrataError::FirstBuyTooLarge);
    a.launch.first_buy_done = true;

    let vesting = a.launch.vesting_days > 0;
    let recipient = if vesting {
        let launch_key = a.launch.key();
        let vest_bump = [ctx.bumps.vest_escrow];
        let vest_seeds: &[&[u8]] = &[VEST_SEED, launch_key.as_ref(), &vest_bump];
        system_program::create_account(
            CpiContext::new_with_signer(
                system_program::ID,
                system_program::CreateAccount { from: a.creator.to_account_info(), to: a.vest_escrow.to_account_info() },
                &[vest_seeds],
            ),
            Rent::get()?.minimum_balance(TOKEN_ACCOUNT_SPACE as usize),
            TOKEN_ACCOUNT_SPACE,
            &a.token_program.key(),
        )?;
        token::initialize_account3(CpiContext::new(
            a.token_program.key(),
            InitializeAccount3 {
                account: a.vest_escrow.to_account_info(),
                mint: a.mint.to_account_info(),
                authority: a.launch.to_account_info(),
            },
        ))?;
        a.vest_escrow.to_account_info()
    } else {
        a.creator_token.to_account_info()
    };

    let minted = execute_buy(
        &mut a.launch,
        &mut a.mint,
        &a.creator.to_account_info(),
        &recipient,
        &a.reserve_vault.to_account_info(),
        &a.curve_vault.to_account_info(),
        &a.creator_fee_vault.to_account_info(),
        a.token_program.key(),
        lamports_in,
        min_tokens_out,
    )?;

    if vesting {
        a.launch.vest_total = minted;
        a.launch.vest_start = Clock::get()?.unix_timestamp;
    }
    Ok(())
}
