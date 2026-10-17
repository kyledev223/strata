use anchor_lang::prelude::*;
use strata_math::MathError;

#[error_code]
pub enum StrataError {
    #[msg("Name must be 1 to 32 characters")]
    InvalidName,
    #[msg("Ticker must be 2 to 10 uppercase letters or digits")]
    InvalidTicker,
    #[msg("Metadata URI is too long")]
    InvalidUri,
    #[msg("A launch setting is outside its allowed range")]
    InvalidSetting,
    #[msg("Redemption delay must be one of the allowed options")]
    InvalidDelay,
    #[msg("Result is worse than the slippage limit")]
    Slippage,
    #[msg("Redemption is not open yet for this launch")]
    RedemptionNotOpen,
    #[msg("The creator's first buy has already happened or someone bought first")]
    FirstBuyUnavailable,
    #[msg("First buy is larger than allowed")]
    FirstBuyTooLarge,
    #[msg("Nothing to claim yet")]
    NothingToClaim,
    #[msg("This launch has no vesting")]
    VestingNotEnabled,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Amount too small to produce any tokens")]
    ZeroOutput,
    #[msg("Buy is below the minimum")]
    BelowMinBuy,
    #[msg("Buy would not back its new tokens at the floor")]
    FloorDilution,
    #[msg("The curve has no tokens left")]
    CurveExhausted,
    #[msg("Invalid token amount")]
    InvalidAmount,
    #[msg("Redemption would pay zero lamports")]
    DustRedemption,
    #[msg("Would leave circulating supply above zero but below the minimum")]
    ResidualSupplyTooSmall,
    #[msg("Invariant: floor would decrease")]
    FloorDecreased,
    #[msg("Invariant: reserve left behind zero supply")]
    ReserveWithoutSupply,
    #[msg("Invariant: curve vault accounting mismatch")]
    CurveInsolvent,
    #[msg("Invariant: curve k decreased")]
    CurveKDecreased,
    #[msg("Invariant: reserve vault holds less than it owes")]
    VaultUnderfunded,
    #[msg("Invariant: mint supply differs from tracked supply")]
    SupplyMismatch,
    #[msg("Wrong metadata account")]
    InvalidMetadataAccount,
}

impl From<MathError> for StrataError {
    fn from(e: MathError) -> Self {
        match e {
            MathError::Overflow => StrataError::Overflow,
            MathError::ZeroOutput => StrataError::ZeroOutput,
            MathError::BelowMinBuy => StrataError::BelowMinBuy,
            MathError::FloorDilution => StrataError::FloorDilution,
            MathError::CurveExhausted => StrataError::CurveExhausted,
            MathError::InvalidAmount => StrataError::InvalidAmount,
            MathError::DustRedemption => StrataError::DustRedemption,
            MathError::RedemptionNotOpen => StrataError::RedemptionNotOpen,
            MathError::ResidualSupplyTooSmall => StrataError::ResidualSupplyTooSmall,
            MathError::FloorDecreased => StrataError::FloorDecreased,
            MathError::ReserveWithoutSupply => StrataError::ReserveWithoutSupply,
            MathError::CurveInsolvent => StrataError::CurveInsolvent,
            MathError::CurveKDecreased => StrataError::CurveKDecreased,
        }
    }
}

/// `?`-friendly conversion for math results.
pub trait OrStrata<T> {
    fn strata(self) -> Result<T>;
}

impl<T> OrStrata<T> for core::result::Result<T, MathError> {
    fn strata(self) -> Result<T> {
        self.map_err(|e| error!(StrataError::from(e)))
    }
}
