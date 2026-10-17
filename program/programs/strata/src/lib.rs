//! Strata: token launches with an on-chain SOL reserve and a floor that only goes up.
//! Spec: PROGRAM_SPEC.md. Floor math: crates/strata-math.

use anchor_lang::prelude::*;

pub mod common;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use instructions::*;
pub use state::*;

declare_id!("2KXPBww71SmCwdh4MAZ8P8UdpkzmFx8eNFd1437Hbw8s");

#[program]
pub mod strata {
    use super::*;

    /// Create a launch: mint, metadata, the launch account and its three vaults.
    pub fn initialize_launch(ctx: Context<InitializeLaunch>, args: LaunchArgs) -> Result<()> {
        instructions::initialize_launch::handle_initialize_launch(ctx, args)
    }

    /// The creator's optional first buy, before anyone else. Vests if the launch says so.
    pub fn creator_buy(ctx: Context<CreatorBuy>, lamports_in: u64, min_tokens_out: u64) -> Result<()> {
        instructions::creator_buy::handle_creator_buy(ctx, lamports_in, min_tokens_out)
    }

    pub fn buy(ctx: Context<Buy>, lamports_in: u64, min_tokens_out: u64) -> Result<()> {
        instructions::buy::handle_buy(ctx, lamports_in, min_tokens_out)
    }

    /// Sell, routed: the curve while it pays at least the floor, then redemption.
    pub fn sell(ctx: Context<Sell>, tokens_in: u64, min_lamports_out: u64) -> Result<()> {
        instructions::sell::handle_sell(ctx, tokens_in, min_lamports_out)
    }

    /// Redeem at the floor: tokens burn, the reserve pays.
    pub fn redeem(ctx: Context<Redeem>, tokens: u64, min_lamports_out: u64) -> Result<()> {
        instructions::redeem::handle_redeem(ctx, tokens, min_lamports_out)
    }

    pub fn claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
        instructions::claim_vested::handle_claim_vested(ctx)
    }

    pub fn claim_creator_fees(ctx: Context<ClaimCreatorFees>) -> Result<()> {
        instructions::claim_creator_fees::handle_claim_creator_fees(ctx)
    }

    /// Permissionless: fold untracked vault lamports (donations) into the drip.
    pub fn sync_reserve(ctx: Context<SyncReserve>) -> Result<()> {
        instructions::sync_reserve::handle_sync_reserve(ctx)
    }
}
