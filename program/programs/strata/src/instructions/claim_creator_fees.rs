use anchor_lang::prelude::*;

use crate::common::{pay_from_vault, vault_rent};
use crate::error::StrataError;
use crate::state::*;

/// Creator fees accrue in their own vault (A10) and never come from the reserve (I6).
#[derive(Accounts)]
pub struct ClaimCreatorFees<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(has_one = creator)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, seeds = [CREATOR_FEES_SEED, launch.key().as_ref()], bump = launch.creator_fees_bump)]
    pub creator_fee_vault: Box<Account<'info, Vault>>,
}

pub fn handle_claim_creator_fees(ctx: Context<ClaimCreatorFees>) -> Result<()> {
    let vault = ctx.accounts.creator_fee_vault.to_account_info();
    let amount = vault.lamports().saturating_sub(vault_rent()?);
    require!(amount > 0, StrataError::NothingToClaim);
    pay_from_vault(&vault, &ctx.accounts.creator.to_account_info(), amount)
}
