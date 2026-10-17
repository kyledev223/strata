use anchor_lang::prelude::*;
use strata_math::{Pool, Settings};

pub const LAUNCH_SEED: &[u8] = b"launch";
pub const RESERVE_SEED: &[u8] = b"reserve";
pub const CURVE_SEED: &[u8] = b"curve";
pub const CREATOR_FEES_SEED: &[u8] = b"creator_fees";
pub const VEST_SEED: &[u8] = b"vest";

pub const HOURS: usize = 48;
pub const DAYS: usize = 32;
pub const NAME_MAX: usize = 32;
pub const TICKER_MAX: usize = 10;
pub const URI_MAX: usize = 200;

/// A program-owned lamport holder. Only strata code can debit it, and only
/// `common::pay_from_reserve` debits the reserve vault.
#[account]
#[derive(InitSpace)]
pub struct Vault {}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug, PartialEq, Eq)]
pub struct PoolState {
    pub v_sol: u64,
    pub v_tokens: u64,
    pub curve_lamports: u64,
    pub reserve: u64,
    pub supply: u64,
    pub hwm_reserve: u64,
    pub hwm_supply: u64,
    pub pending: u64,
    pub drip_last_slot: u64,
    pub drip_until_slot: u64,
}

impl From<PoolState> for Pool {
    fn from(s: PoolState) -> Pool {
        Pool {
            v_sol: s.v_sol,
            v_tokens: s.v_tokens,
            curve_lamports: s.curve_lamports,
            reserve: s.reserve,
            supply: s.supply,
            hwm_reserve: s.hwm_reserve,
            hwm_supply: s.hwm_supply,
            pending: s.pending,
            drip_last_slot: s.drip_last_slot,
            drip_until_slot: s.drip_until_slot,
        }
    }
}

impl From<Pool> for PoolState {
    fn from(p: Pool) -> PoolState {
        PoolState {
            v_sol: p.v_sol,
            v_tokens: p.v_tokens,
            curve_lamports: p.curve_lamports,
            reserve: p.reserve,
            supply: p.supply,
            hwm_reserve: p.hwm_reserve,
            hwm_supply: p.hwm_supply,
            pending: p.pending,
            drip_last_slot: p.drip_last_slot,
            drip_until_slot: p.drip_until_slot,
        }
    }
}

/// Hourly or daily close, for charts and 24h volume without an indexer.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace, Debug)]
pub struct Bucket {
    /// Lamports per 1M tokens at the close of the bucket.
    pub price_per_m: u64,
    pub floor_per_m: u64,
    /// Lamports traded in the bucket.
    pub volume: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub version: u8,
    pub bump: u8,
    pub reserve_bump: u8,
    pub curve_bump: u8,
    pub creator_fees_bump: u8,
    pub mint: Pubkey,
    pub creator: Pubkey,
    // Settings, fixed at launch (I12).
    pub reserve_share_bps: u16,
    pub fee_to_reserve_bps: u16,
    pub creator_fee_bps: u16,
    pub vesting_days: u16,
    pub created_at: i64,
    pub redemption_opens_at: i64,
    pub first_buy_done: bool,
    pub pool: PoolState,
    // Vesting of the creator's first buy.
    pub vest_total: u64,
    pub vest_claimed: u64,
    pub vest_start: i64,
    // Lifetime stats.
    pub creator_fees_total: u64,
    pub floor_raises: u64,
    pub redeemed_base: u64,
    pub redeemed_lamports: u64,
    pub fees_to_reserve: u64,
    pub volume_total: u64,
    pub trades: u64,
    // Ring buffers: bucket for hour h lives at hourly[h % HOURS].
    pub hour_index: i64,
    pub day_index: i64,
    pub hourly: [Bucket; HOURS],
    pub daily: [Bucket; DAYS],
    #[max_len(NAME_MAX)]
    pub name: String,
    #[max_len(TICKER_MAX)]
    pub ticker: String,
    #[max_len(URI_MAX)]
    pub uri: String,
}

impl Launch {
    pub fn settings(&self) -> Settings {
        Settings {
            reserve_share_bps: self.reserve_share_bps,
            fee_to_reserve_bps: self.fee_to_reserve_bps,
            creator_fee_bps: self.creator_fee_bps,
        }
    }

    pub fn math_pool(&self) -> Pool {
        self.pool.into()
    }
}
