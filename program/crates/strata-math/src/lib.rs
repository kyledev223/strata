//! Exact integer floor math for Strata. See PROGRAM_SPEC.md §6.
//!
//! Units: SOL in lamports, tokens in base units. Every function is pure: it takes
//! a [`Pool`] and returns the new pool plus the amounts to move. The program
//! moves the lamports and tokens, then calls [`check`] on (before, after).
//!
//! Rounding always favours the vault: payouts round down, anything owed to the
//! reserve rounds up.

#![cfg_attr(not(test), no_std)]

pub mod limits {
    include!(concat!(env!("OUT_DIR"), "/limits.rs"));
}

use limits::*;

uint::construct_uint! {
    /// 256-bit integer for the one product that can exceed u128 (sell room).
    pub struct U256(4);
}

pub const BPS: u64 = 10_000;
/// Smallest the curve's virtual token reserve may reach: the supply cap.
pub const V_TOKENS_MIN: u64 = V_TOKENS_START - MAX_SUPPLY_BASE;
/// "Per 1M tokens" scale for prices and floors reported in events and stats.
pub const PER_MILLION_BASE: u128 = 1_000_000 * BASE_PER_TOKEN as u128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MathError {
    Overflow,
    ZeroOutput,
    BelowMinBuy,
    FloorDilution,
    CurveExhausted,
    InvalidAmount,
    DustRedemption,
    RedemptionNotOpen,
    ResidualSupplyTooSmall,
    FloorDecreased,
    ReserveWithoutSupply,
    CurveInsolvent,
    CurveKDecreased,
}

type R<T> = Result<T, MathError>;

/// Settings fixed at launch, in basis points.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Settings {
    pub reserve_share_bps: u16,
    pub fee_to_reserve_bps: u16,
    pub creator_fee_bps: u16,
}

/// Everything the floor math needs about one launch.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Pool {
    /// Virtual curve reserves (lamports, base units). k = v_sol * v_tokens never decreases.
    pub v_sol: u64,
    pub v_tokens: u64,
    /// Real lamports the curve vault owes: always v_sol - V_SOL_START.
    pub curve_lamports: u64,
    /// The reserve behind the floor, R (lamports).
    pub reserve: u64,
    /// Circulating supply, S (base units). Equals the mint's supply.
    pub supply: u64,
    /// Last (R, S) with S > 0: the floor to back new tokens at when S = 0.
    pub hwm_reserve: u64,
    pub hwm_supply: u64,
    /// Surplus held in the reserve vault, released into R linearly (spec D2).
    pub pending: u64,
    pub drip_last_slot: u64,
    pub drip_until_slot: u64,
}

impl Pool {
    pub fn new() -> Self {
        Pool { v_sol: V_SOL_START, v_tokens: V_TOKENS_START, ..Default::default() }
    }

    pub fn k(&self) -> u128 {
        self.v_sol as u128 * self.v_tokens as u128
    }

    /// The floor new tokens must be backed at, as (numerator, denominator):
    /// R / S, or the high-water mark at zero supply, or none before the first buy.
    pub fn required_floor(&self) -> Option<(u64, u64)> {
        if self.supply > 0 {
            Some((self.reserve, self.supply))
        } else if self.hwm_supply > 0 {
            Some((self.hwm_reserve, self.hwm_supply))
        } else {
            None
        }
    }

    /// Tokens the curve can still release before max supply.
    pub fn inventory(&self) -> u64 {
        self.v_tokens.saturating_sub(V_TOKENS_MIN)
    }

    /// Spot price in lamports per 1M tokens (for stats and events).
    pub fn price_per_m(&self) -> u64 {
        sat_u64(self.v_sol as u128 * PER_MILLION_BASE / self.v_tokens.max(1) as u128)
    }

    /// Floor in lamports per 1M tokens, 0 when nothing circulates.
    pub fn floor_per_m(&self) -> u64 {
        match self.supply {
            0 => 0,
            s => sat_u64(self.reserve as u128 * PER_MILLION_BASE / s as u128),
        }
    }

    fn record_hwm(&mut self) {
        if self.supply > 0 {
            self.hwm_reserve = self.reserve;
            self.hwm_supply = self.supply;
        }
    }
}

/* ------------------------------------------------------------ helpers */

fn sat_u64(v: u128) -> u64 {
    if v > u64::MAX as u128 { u64::MAX } else { v as u64 }
}

fn to_u64(v: u128) -> R<u64> {
    u64::try_from(v).map_err(|_| MathError::Overflow)
}

pub fn ceil_div(a: u128, b: u128) -> R<u128> {
    if b == 0 {
        return Err(MathError::Overflow);
    }
    Ok(a / b + u128::from(a % b != 0))
}

fn mul_bps_down(x: u64, bps: u16) -> u64 {
    (x as u128 * bps as u128 / BPS as u128) as u64
}

fn mul_bps_up(x: u64, bps: u16) -> R<u64> {
    to_u64(ceil_div(x as u128 * bps as u128, BPS as u128)?)
}

/// ceil(t * num / den): the reserve backing `t` new tokens need.
fn backing(t: u64, floor: Option<(u64, u64)>) -> R<u64> {
    match floor {
        None => Ok(0),
        Some((num, den)) => to_u64(ceil_div(t as u128 * num as u128, den as u128)?),
    }
}

/// Tokens out of the curve for `x` lamports, rounded down.
fn curve_tokens_out(p: &Pool, x: u64) -> R<u64> {
    if x == 0 {
        return Ok(0);
    }
    let denom = p.v_sol as u128 + x as u128;
    let v_tokens_after = ceil_div(p.k(), denom)?;
    Ok(p.v_tokens.saturating_sub(to_u64(v_tokens_after)?))
}

/// Lamports the curve must receive to release `t` tokens, rounded up.
fn curve_cost(p: &Pool, t: u64) -> R<u64> {
    if t >= p.v_tokens {
        return Err(MathError::Overflow);
    }
    let v_sol_after = ceil_div(p.k(), (p.v_tokens - t) as u128)?;
    to_u64(v_sol_after.checked_sub(p.v_sol as u128).ok_or(MathError::Overflow)?)
}

fn isqrt_u256(n: U256) -> U256 {
    if n < U256::from(2u8) {
        return n;
    }
    let mut x = n;
    let mut y = (x + U256::one()) >> 1;
    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }
    x
}

/* --------------------------------------------------------------- drip */

/// Release the elapsed share of pending surplus into the reserve. Only while
/// tokens circulate; at zero supply it waits (spec A9, I4).
pub fn release_drip(p: &mut Pool, now_slot: u64) {
    if p.pending == 0 || p.supply == 0 {
        p.drip_last_slot = now_slot.max(p.drip_last_slot);
        return;
    }
    let release = if now_slot >= p.drip_until_slot {
        p.pending
    } else if now_slot <= p.drip_last_slot {
        0
    } else {
        let elapsed = (now_slot - p.drip_last_slot) as u128;
        let window = (p.drip_until_slot - p.drip_last_slot) as u128;
        (p.pending as u128 * elapsed / window) as u64
    };
    p.reserve += release;
    p.pending -= release;
    p.drip_last_slot = now_slot.max(p.drip_last_slot);
    p.record_hwm();
}

/// Add surplus to the drip. The remaining pending amount and the new surplus
/// are released together over the next DRIP_SLOTS.
pub fn add_surplus(p: &mut Pool, amount: u64, now_slot: u64) -> R<()> {
    if amount == 0 {
        return Ok(());
    }
    p.pending = p.pending.checked_add(amount).ok_or(MathError::Overflow)?;
    p.drip_last_slot = now_slot;
    p.drip_until_slot = now_slot + DRIP_SLOTS;
    Ok(())
}

/* ---------------------------------------------------------------- buy */

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct BuyQuote {
    pub tokens_out: u64,
    pub creator_fee: u64,
    pub reserve_fee: u64,
    /// Lamports into the reserve vault: `deposit + reserve_fee`.
    pub to_reserve_vault: u64,
    /// Lamports into the curve vault.
    pub to_curve: u64,
    /// Of the reserve-vault lamports, how much counts toward R now (backing).
    pub to_reserve_now: u64,
    /// ...and how much drips in later (surplus).
    pub surplus: u64,
    /// True when the reserve share alone couldn't back the new tokens.
    pub topped_up: bool,
    pub after: Pool,
}

/// Quote a buy of `lamports_in`. Spec §6.3 and invariant I1.
pub fn buy(p: &Pool, s: &Settings, lamports_in: u64, now_slot: u64) -> R<BuyQuote> {
    if lamports_in < MIN_BUY_LAMPORTS {
        return Err(MathError::BelowMinBuy);
    }
    let creator_fee = mul_bps_down(lamports_in, s.creator_fee_bps);
    let reserve_fee = mul_bps_up(lamports_in, s.fee_to_reserve_bps)?;
    let net = lamports_in.checked_sub(creator_fee + reserve_fee).ok_or(MathError::Overflow)?;
    let share = mul_bps_up(net, s.reserve_share_bps)?.min(net);
    let floor = p.required_floor();

    let t1 = curve_tokens_out(p, net - share)?;
    let (tokens_out, to_curve, deposit, topped_up) = if backing(t1, floor)? <= share {
        (t1, net - share, share, false)
    } else {
        // Largest t whose backing plus curve cost fits in `net`.
        let (mut lo, mut hi) = (0u64, t1);
        while lo < hi {
            let mid = lo + (hi - lo + 1) / 2;
            if backing(mid, floor)? + curve_cost(p, mid)? <= net {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        let to_curve = if lo == 0 { 0 } else { curve_cost(p, lo)? };
        (lo, to_curve, net - to_curve, true)
    };

    if tokens_out == 0 {
        return Err(MathError::ZeroOutput);
    }
    if tokens_out > p.inventory() {
        return Err(MathError::CurveExhausted);
    }
    let required = backing(tokens_out, floor)?;
    if deposit < required {
        return Err(MathError::FloorDilution); // I1
    }

    let mut a = *p;
    a.v_sol = a.v_sol.checked_add(to_curve).ok_or(MathError::Overflow)?;
    a.v_tokens -= tokens_out;
    a.curve_lamports = a.curve_lamports.checked_add(to_curve).ok_or(MathError::Overflow)?;
    let to_reserve_vault = deposit + reserve_fee;
    // With nothing circulating there is no one to front-run, so it all counts now.
    let (to_reserve_now, surplus) = if p.supply == 0 { (to_reserve_vault, 0) } else { (required, to_reserve_vault - required) };
    a.reserve = a.reserve.checked_add(to_reserve_now).ok_or(MathError::Overflow)?;
    a.supply = a.supply.checked_add(tokens_out).ok_or(MathError::Overflow)?;
    add_surplus(&mut a, surplus, now_slot)?;
    a.record_hwm();

    Ok(BuyQuote { tokens_out, creator_fee, reserve_fee, to_reserve_vault, to_curve, to_reserve_now, surplus, topped_up, after: a })
}

/* --------------------------------------------------------------- sell */

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SellQuote {
    pub to_curve_tokens: u64,
    pub to_redeem_tokens: u64,
    /// Lamports leaving the curve vault in total (`curve_out + fees`).
    pub gross: u64,
    pub creator_fee: u64,
    pub reserve_fee: u64,
    /// Lamports to the seller from the curve vault.
    pub curve_out: u64,
    /// Lamports to the seller from the reserve vault.
    pub redeem_out: u64,
    pub after: Pool,
}

/// Sell `tokens_in`, routed: the curve while it pays at least the floor net of
/// fees, then redemption at the floor. Spec §6.4 and invariant I2.
pub fn sell(p: &Pool, s: &Settings, tokens_in: u64, redemption_open: bool, now_slot: u64) -> R<SellQuote> {
    if tokens_in == 0 || tokens_in > p.supply {
        return Err(MathError::InvalidAmount);
    }
    let fee_bps = s.fee_to_reserve_bps as u64 + s.creator_fee_bps as u64;

    // Room on the curve: (vT + t)^2 <= k (1 - f) S / R.
    let room = if p.reserve == 0 {
        u64::MAX
    } else {
        let num = U256::from(p.k()) * U256::from(BPS - fee_bps) * U256::from(p.supply);
        let den = U256::from(BPS) * U256::from(p.reserve);
        let lim = isqrt_u256(num / den);
        let lim = if lim > U256::from(u64::MAX) { u64::MAX } else { lim.as_u64() };
        lim.saturating_sub(p.v_tokens)
    };
    let mut t_curve = tokens_in.min(room);
    // Selling the whole supply: at least one unit must redeem, so the reserve is paid out
    // instead of being orphaned behind zero supply (spec A8).
    if tokens_in == p.supply && p.reserve + p.pending > 0 {
        t_curve = t_curve.min(tokens_in - 1);
    }

    let mut a = *p;
    let (mut gross, mut creator_fee, mut reserve_fee, mut curve_out) = (0, 0, 0, 0);
    if t_curve > 0 {
        let k = a.k();
        a.v_tokens = a.v_tokens.checked_add(t_curve).ok_or(MathError::Overflow)?;
        let v_sol_after = to_u64(ceil_div(k, a.v_tokens as u128)?)?;
        gross = a.v_sol - v_sol_after;
        a.v_sol = v_sol_after;
        a.curve_lamports = a.curve_lamports.checked_sub(gross).ok_or(MathError::CurveInsolvent)?;
        creator_fee = mul_bps_down(gross, s.creator_fee_bps);
        reserve_fee = mul_bps_up(gross, s.fee_to_reserve_bps)?;
        curve_out = gross.checked_sub(creator_fee + reserve_fee).ok_or(MathError::Overflow)?;
        a.supply -= t_curve;
        add_surplus(&mut a, reserve_fee, now_slot)?;
    }

    let t_redeem = tokens_in - t_curve;
    let mut redeem_out = 0;
    if t_redeem > 0 {
        if !redemption_open {
            return Err(MathError::RedemptionNotOpen);
        }
        redeem_out = redeem_leg(&mut a, t_redeem, true)?;
    }
    a.record_hwm();
    Ok(SellQuote { to_curve_tokens: t_curve, to_redeem_tokens: t_redeem, gross, creator_fee, reserve_fee, curve_out, redeem_out, after: a })
}

/* ------------------------------------------------------------- redeem */

/// Pay out `t` tokens at the floor and burn them. Redeeming the whole supply
/// collects any pending surplus first and pays exactly the reserve.
fn redeem_leg(a: &mut Pool, t: u64, allow_zero_payout: bool) -> R<u64> {
    if a.supply == 0 || t > a.supply {
        return Err(MathError::InvalidAmount);
    }
    let payout = if t == a.supply {
        a.reserve = a.reserve.checked_add(a.pending).ok_or(MathError::Overflow)?;
        a.pending = 0;
        a.reserve
    } else {
        to_u64(t as u128 * a.reserve as u128 / a.supply as u128)?
    };
    if payout == 0 && !allow_zero_payout {
        return Err(MathError::DustRedemption);
    }
    a.reserve -= payout;
    a.supply -= t;
    Ok(payout)
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct RedeemQuote {
    pub payout: u64,
    pub after: Pool,
}

/// Redeem `tokens` at the floor. Spec §6.5.
pub fn redeem(p: &Pool, tokens: u64) -> R<RedeemQuote> {
    if tokens == 0 {
        return Err(MathError::InvalidAmount);
    }
    let mut a = *p;
    let payout = redeem_leg(&mut a, tokens, false)?;
    a.record_hwm();
    Ok(RedeemQuote { payout, after: a })
}

/* ---------------------------------------------------------- invariants */

/// Invariants I4, I7, I8 and I11, checked on (before, after) at the end of
/// every instruction. Vault balances and mint supply (I9, I10) are checked by
/// the program against real accounts.
pub fn check(before: &Pool, after: &Pool) -> R<()> {
    // I4: no reserve behind zero supply.
    if after.supply == 0 && after.reserve != 0 {
        return Err(MathError::ReserveWithoutSupply);
    }
    // I8: no dust residual.
    if after.supply != 0 && after.supply < MIN_CIRCULATING_BASE {
        return Err(MathError::ResidualSupplyTooSmall);
    }
    // I7: floor never decreases (against the high-water mark at zero supply).
    if after.supply > 0 {
        if let Some((rb, sb)) = before.required_floor() {
            if (after.reserve as u128) * (sb as u128) < (rb as u128) * (after.supply as u128) {
                return Err(MathError::FloorDecreased);
            }
        }
    }
    // I11: curve solvency and k monotonic.
    if after.curve_lamports as u128 + V_SOL_START as u128 != after.v_sol as u128 {
        return Err(MathError::CurveInsolvent);
    }
    if after.k() < before.k() {
        return Err(MathError::CurveKDecreased);
    }
    Ok(())
}

#[cfg(test)]
mod tests;
