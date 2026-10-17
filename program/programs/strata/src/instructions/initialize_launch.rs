use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3, Metadata,
};
use anchor_spl::token::{self, InitializeMint2, Token};
use strata_math::limits::*;
use strata_math::Pool;

use crate::common::pay_from_wallet;
use crate::error::StrataError;
use crate::events::LaunchCreated;
use crate::state::*;

pub const TREASURY_KEY: Pubkey = Pubkey::from_str_const(TREASURY);
const MINT_SPACE: u64 = 82;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct LaunchArgs {
    pub name: String,
    pub ticker: String,
    /// Off-chain metadata JSON (image, description). May be empty.
    pub uri: String,
    pub reserve_share_bps: u16,
    pub fee_to_reserve_bps: u16,
    pub creator_fee_bps: u16,
    /// 0 = no vesting on the creator's first buy.
    pub vesting_days: u16,
    pub redemption_delay_hours: u32,
}

#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: a fresh keypair; created as an SPL mint by the handler.
    #[account(mut, signer)]
    pub mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Launch::INIT_SPACE,
        seeds = [LAUNCH_SEED, mint.key().as_ref()],
        bump
    )]
    pub launch: Box<Account<'info, Launch>>,

    #[account(init, payer = creator, space = 8 + Vault::INIT_SPACE, seeds = [RESERVE_SEED, launch.key().as_ref()], bump)]
    pub reserve_vault: Box<Account<'info, Vault>>,

    #[account(init, payer = creator, space = 8 + Vault::INIT_SPACE, seeds = [CURVE_SEED, launch.key().as_ref()], bump)]
    pub curve_vault: Box<Account<'info, Vault>>,

    #[account(init, payer = creator, space = 8 + Vault::INIT_SPACE, seeds = [CREATOR_FEES_SEED, launch.key().as_ref()], bump)]
    pub creator_fee_vault: Box<Account<'info, Vault>>,

    /// CHECK: Metaplex metadata PDA for `mint`; verified in the handler and by Metaplex.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(mut, address = TREASURY_KEY)]
    pub treasury: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

fn validate(args: &LaunchArgs) -> Result<()> {
    let name_len = args.name.chars().count();
    require!(name_len >= 1 && name_len <= NAME_MAX_CHARS && args.name.len() <= NAME_MAX, StrataError::InvalidName);
    let t = &args.ticker;
    require!(
        t.len() >= TICKER_MIN_CHARS && t.len() <= TICKER_MAX_CHARS && t.bytes().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()),
        StrataError::InvalidTicker
    );
    require!(args.uri.len() <= URI_MAX, StrataError::InvalidUri);
    require!(
        (RESERVE_SHARE_MIN_BPS..=RESERVE_SHARE_MAX_BPS).contains(&args.reserve_share_bps)
            && (FEE_TO_RESERVE_MIN_BPS..=FEE_TO_RESERVE_MAX_BPS).contains(&args.fee_to_reserve_bps)
            && (CREATOR_FEE_MIN_BPS..=CREATOR_FEE_MAX_BPS).contains(&args.creator_fee_bps)
            && (args.vesting_days == 0 || (VESTING_DAYS_MIN..=VESTING_DAYS_MAX).contains(&args.vesting_days)),
        StrataError::InvalidSetting
    );
    require!(REDEMPTION_DELAY_OPTIONS_HOURS.contains(&args.redemption_delay_hours), StrataError::InvalidDelay);
    Ok(())
}

pub fn handle_initialize_launch(ctx: Context<InitializeLaunch>, args: LaunchArgs) -> Result<()> {
    validate(&args)?;
    let now = Clock::get()?.unix_timestamp;
    let mint_key = ctx.accounts.mint.key();
    let launch_key = ctx.accounts.launch.key();
    let launch_bump = ctx.bumps.launch;
    let seeds: &[&[u8]] = &[LAUNCH_SEED, mint_key.as_ref(), &[launch_bump]];

    // Mint: 6 decimals, authority = this launch, no freeze authority (A12).
    let rent = Rent::get()?;
    system_program::create_account(
        CpiContext::new(
            system_program::ID,
            system_program::CreateAccount { from: ctx.accounts.creator.to_account_info(), to: ctx.accounts.mint.to_account_info() },
        ),
        rent.minimum_balance(MINT_SPACE as usize),
        MINT_SPACE,
        &ctx.accounts.token_program.key(),
    )?;
    token::initialize_mint2(
        CpiContext::new(ctx.accounts.token_program.key(), InitializeMint2 { mint: ctx.accounts.mint.to_account_info() }),
        DECIMALS,
        &launch_key,
        None,
    )?;

    // Metadata: immutable, update authority = this launch (D4).
    let mpl = ctx.accounts.token_metadata_program.key();
    let (expected_metadata, _) = Pubkey::find_program_address(&[b"metadata", mpl.as_ref(), mint_key.as_ref()], &mpl);
    require_keys_eq!(ctx.accounts.metadata.key(), expected_metadata, StrataError::InvalidMetadataAccount);
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            mpl,
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.launch.to_account_info(),
                payer: ctx.accounts.creator.to_account_info(),
                update_authority: ctx.accounts.launch.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &[seeds],
        ),
        DataV2 {
            name: args.name.clone(),
            symbol: args.ticker.clone(),
            uri: args.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        },
        false,
        true,
        None,
    )?;

    // Launch fee to the treasury; never touches any vault (D5).
    pay_from_wallet(&ctx.accounts.creator.to_account_info(), &ctx.accounts.treasury.to_account_info(), LAUNCH_FEE_LAMPORTS)?;

    let launch = &mut ctx.accounts.launch;
    launch.version = 1;
    launch.bump = launch_bump;
    launch.reserve_bump = ctx.bumps.reserve_vault;
    launch.curve_bump = ctx.bumps.curve_vault;
    launch.creator_fees_bump = ctx.bumps.creator_fee_vault;
    launch.mint = mint_key;
    launch.creator = ctx.accounts.creator.key();
    launch.reserve_share_bps = args.reserve_share_bps;
    launch.fee_to_reserve_bps = args.fee_to_reserve_bps;
    launch.creator_fee_bps = args.creator_fee_bps;
    launch.vesting_days = args.vesting_days;
    launch.created_at = now;
    launch.redemption_opens_at = now + args.redemption_delay_hours as i64 * 3600;
    launch.pool = Pool::new().into();
    launch.name = args.name.clone();
    launch.ticker = args.ticker.clone();
    launch.uri = args.uri;

    emit!(LaunchCreated { launch: launch_key, mint: mint_key, creator: launch.creator, name: args.name, ticker: args.ticker, ts: now });
    Ok(())
}
