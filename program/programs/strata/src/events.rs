use anchor_lang::prelude::*;

pub const KIND_BUY: u8 = 0;
pub const KIND_SELL: u8 = 1;
pub const KIND_REDEEM: u8 = 2;

#[event]
pub struct LaunchCreated {
    pub launch: Pubkey,
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub ticker: String,
    pub ts: i64,
}

/// One per buy, sell or redeem. The UI's activity feed reads these.
#[event]
pub struct Trade {
    pub launch: Pubkey,
    pub mint: Pubkey,
    pub user: Pubkey,
    pub kind: u8,
    /// Lamports paid in (buy) or out (sell, redeem).
    pub lamports: u64,
    pub tokens: u64,
    /// Of a sell, how many tokens went to the redemption leg.
    pub redeemed_tokens: u64,
    pub price_per_m: u64,
    pub floor_per_m: u64,
    pub reserve: u64,
    pub supply: u64,
    pub ts: i64,
}
