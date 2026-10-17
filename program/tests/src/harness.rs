use anchor_lang::{prelude::Pubkey, AccountDeserialize, InstructionData, ToAccountMetas};
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;
use litesvm::LiteSVM;
use solana_clock::Clock;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_signer::Signer;
use solana_transaction::Transaction;
use strata::state::*;
use strata_math::limits::TREASURY;

pub const SOL: u64 = 1_000_000_000;
pub const TOK: u64 = strata_math::limits::BASE_PER_TOKEN;
pub const MPL: Pubkey = Pubkey::from_str_const("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
pub const RENT_SYSVAR: Pubkey = Pubkey::from_str_const("SysvarRent111111111111111111111111111111111");
pub const ATA_PROGRAM: Pubkey = Pubkey::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

pub fn treasury() -> Pubkey {
    Pubkey::from_str_const(TREASURY)
}

pub struct Env {
    pub svm: LiteSVM,
}

#[allow(dead_code)]
pub struct Pdas {
    pub mint: Pubkey,
    pub launch: Pubkey,
    pub reserve: Pubkey,
    pub curve: Pubkey,
    pub fees: Pubkey,
    pub vest: Pubkey,
    pub metadata: Pubkey,
}

pub fn pdas(mint: Pubkey) -> Pdas {
    let p = |seeds: &[&[u8]]| Pubkey::find_program_address(seeds, &strata::ID).0;
    let launch = p(&[LAUNCH_SEED, mint.as_ref()]);
    Pdas {
        mint,
        launch,
        reserve: p(&[RESERVE_SEED, launch.as_ref()]),
        curve: p(&[CURVE_SEED, launch.as_ref()]),
        fees: p(&[CREATOR_FEES_SEED, launch.as_ref()]),
        vest: p(&[VEST_SEED, launch.as_ref()]),
        metadata: Pubkey::find_program_address(&[b"metadata", MPL.as_ref(), mint.as_ref()], &MPL).0,
    }
}

#[derive(Clone, Debug)]
pub struct Opts {
    pub reserve_share_bps: u16,
    pub fee_to_reserve_bps: u16,
    pub creator_fee_bps: u16,
    pub vesting_days: u16,
    pub delay_hours: u32,
}

impl Default for Opts {
    fn default() -> Self {
        Opts { reserve_share_bps: 2500, fee_to_reserve_bps: 100, creator_fee_bps: 50, vesting_days: 0, delay_hours: 0 }
    }
}

pub type TxResult = Result<litesvm::types::TransactionMetadata, litesvm::types::FailedTransactionMetadata>;

impl Env {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new();
        let dir = env!("CARGO_MANIFEST_DIR");
        svm.add_program_from_file(strata::ID, format!("{dir}/../target/deploy/strata.so")).expect("build the program first: anchor build");
        svm.add_program_from_file(MPL, format!("{dir}/fixtures/mpl_token_metadata.so")).expect("dump Metaplex into tests/fixtures");
        let mut c: Clock = svm.get_sysvar();
        c.unix_timestamp = 1_790_000_000;
        c.slot = 1_000;
        svm.set_sysvar(&c);
        Env { svm }
    }

    pub fn wallet(&mut self, sol: u64) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), sol * SOL).unwrap();
        k
    }

    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> TxResult {
        let mut signers: Vec<&Keypair> = vec![payer];
        signers.extend_from_slice(extra);
        let msg = Message::new(ixs, Some(&payer.pubkey()));
        let tx = Transaction::new(&signers, msg, self.svm.latest_blockhash());
        let r = self.svm.send_transaction(tx);
        self.svm.expire_blockhash();
        r
    }

    /// Move the clock forward.
    pub fn warp(&mut self, secs: i64, slots: u64) {
        let mut c: Clock = self.svm.get_sysvar();
        c.unix_timestamp += secs;
        c.slot += slots;
        self.svm.set_sysvar(&c);
    }

    pub fn lamports(&self, k: &Pubkey) -> u64 {
        self.svm.get_account(k).map(|a| a.lamports).unwrap_or(0)
    }

    pub fn launch(&self, mint: &Pubkey) -> Launch {
        let a = self.svm.get_account(&pdas(*mint).launch).expect("launch exists");
        Launch::try_deserialize(&mut a.data.as_slice()).unwrap()
    }

    pub fn token_balance(&self, owner: &Pubkey, mint: &Pubkey) -> u64 {
        self.svm
            .get_account(&get_associated_token_address(owner, mint))
            .map(|a| u64::from_le_bytes(a.data[64..72].try_into().unwrap()))
            .unwrap_or(0)
    }

    pub fn mint_supply(&self, mint: &Pubkey) -> u64 {
        let a = self.svm.get_account(mint).unwrap();
        u64::from_le_bytes(a.data[36..44].try_into().unwrap())
    }

    pub fn vault_rent(&self) -> u64 {
        self.svm.minimum_balance_for_rent_exemption(8)
    }
}

/* ------------------------------------------------------------ instructions */

pub fn ix_create_ata(payer: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> Instruction {
    use anchor_lang::solana_program::instruction::AccountMeta;
    Instruction {
        program_id: ATA_PROGRAM,
        accounts: vec![
            AccountMeta::new(*payer, true),
            AccountMeta::new(get_associated_token_address(owner, mint), false),
            AccountMeta::new_readonly(*owner, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new_readonly(anchor_lang::system_program::ID, false),
            AccountMeta::new_readonly(spl_token::ID, false),
        ],
        data: vec![1], // CreateIdempotent
    }
}

pub fn ix_initialize(creator: &Pubkey, mint: &Pubkey, o: &Opts, name: &str, ticker: &str) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::InitializeLaunch {
            creator: *creator,
            mint: *mint,
            launch: p.launch,
            reserve_vault: p.reserve,
            curve_vault: p.curve,
            creator_fee_vault: p.fees,
            metadata: p.metadata,
            treasury: treasury(),
            token_program: spl_token::ID,
            token_metadata_program: MPL,
            system_program: anchor_lang::system_program::ID,
            rent: RENT_SYSVAR,
        }
        .to_account_metas(None),
        data: strata::instruction::InitializeLaunch {
            args: strata::LaunchArgs {
                name: name.into(),
                ticker: ticker.into(),
                uri: String::new(),
                reserve_share_bps: o.reserve_share_bps,
                fee_to_reserve_bps: o.fee_to_reserve_bps,
                creator_fee_bps: o.creator_fee_bps,
                vesting_days: o.vesting_days,
                redemption_delay_hours: o.delay_hours,
            },
        }
        .data(),
    }
}

pub fn ix_creator_buy(creator: &Pubkey, mint: &Pubkey, lamports: u64, min_out: u64) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::CreatorBuy {
            creator: *creator,
            launch: p.launch,
            mint: *mint,
            reserve_vault: p.reserve,
            curve_vault: p.curve,
            creator_fee_vault: p.fees,
            creator_token: get_associated_token_address(creator, mint),
            vest_escrow: p.vest,
            token_program: spl_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: strata::instruction::CreatorBuy { lamports_in: lamports, min_tokens_out: min_out }.data(),
    }
}

pub fn ix_buy(buyer: &Pubkey, mint: &Pubkey, lamports: u64, min_out: u64) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::Buy {
            buyer: *buyer,
            launch: p.launch,
            mint: *mint,
            reserve_vault: p.reserve,
            curve_vault: p.curve,
            creator_fee_vault: p.fees,
            buyer_token: get_associated_token_address(buyer, mint),
            token_program: spl_token::ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
        data: strata::instruction::Buy { lamports_in: lamports, min_tokens_out: min_out }.data(),
    }
}

pub fn ix_sell(seller: &Pubkey, mint: &Pubkey, tokens: u64, min_out: u64) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::Sell {
            seller: *seller,
            launch: p.launch,
            mint: *mint,
            reserve_vault: p.reserve,
            curve_vault: p.curve,
            creator_fee_vault: p.fees,
            seller_token: get_associated_token_address(seller, mint),
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
        data: strata::instruction::Sell { tokens_in: tokens, min_lamports_out: min_out }.data(),
    }
}

pub fn ix_redeem(holder: &Pubkey, mint: &Pubkey, tokens: u64, min_out: u64) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::Redeem {
            holder: *holder,
            launch: p.launch,
            mint: *mint,
            reserve_vault: p.reserve,
            curve_vault: p.curve,
            holder_token: get_associated_token_address(holder, mint),
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
        data: strata::instruction::Redeem { tokens, min_lamports_out: min_out }.data(),
    }
}

pub fn ix_claim_vested(creator: &Pubkey, mint: &Pubkey) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::ClaimVested {
            creator: *creator,
            launch: p.launch,
            mint: *mint,
            vest_escrow: p.vest,
            creator_token: get_associated_token_address(creator, mint),
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
        data: strata::instruction::ClaimVested {}.data(),
    }
}

pub fn ix_claim_fees(creator: &Pubkey, mint: &Pubkey) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::ClaimCreatorFees { creator: *creator, launch: p.launch, creator_fee_vault: p.fees }.to_account_metas(None),
        data: strata::instruction::ClaimCreatorFees {}.data(),
    }
}

pub fn ix_sync(mint: &Pubkey) -> Instruction {
    let p = pdas(*mint);
    Instruction {
        program_id: strata::ID,
        accounts: strata::accounts::SyncReserve { launch: p.launch, mint: *mint, reserve_vault: p.reserve, curve_vault: p.curve }.to_account_metas(None),
        data: strata::instruction::SyncReserve {}.data(),
    }
}

/* -------------------------------------------------------------- scenarios */

/// Create a launch, optionally with the creator's first buy in the same transaction.
pub fn launch(env: &mut Env, creator: &Keypair, o: &Opts, first_buy: u64) -> Pubkey {
    let mint = Keypair::new();
    let mut ixs = vec![ix_initialize(&creator.pubkey(), &mint.pubkey(), o, "Test Stone", "TST")];
    if first_buy > 0 {
        ixs.push(ix_create_ata(&creator.pubkey(), &creator.pubkey(), &mint.pubkey()));
        ixs.push(ix_creator_buy(&creator.pubkey(), &mint.pubkey(), first_buy, 0));
    }
    let r = env.send(&ixs, creator, &[&mint]);
    if let Err(e) = &r {
        panic!("launch failed: {:?}\n{}", e.err, e.meta.logs.join("\n"));
    }
    mint.pubkey()
}

pub fn buy(env: &mut Env, user: &Keypair, mint: &Pubkey, lamports: u64) -> TxResult {
    let ixs = [ix_create_ata(&user.pubkey(), &user.pubkey(), mint), ix_buy(&user.pubkey(), mint, lamports, 0)];
    env.send(&ixs, user, &[])
}

/// The custom error code a failed transaction returned, if any. Read from the
/// error's debug form so it doesn't depend on which error-crate version LiteSVM uses.
pub fn error_code(r: &TxResult) -> Option<u32> {
    let s = format!("{:?}", r.as_ref().err()?.err);
    let i = s.find("Custom(")? + "Custom(".len();
    s[i..].split(')').next()?.parse().ok()
}

pub fn code(e: strata::error::StrataError) -> u32 {
    anchor_lang::error::ERROR_CODE_OFFSET + e as u32
}

/// Re-check the invariants from chain state alone. `last` carries the previous
/// floor (or high-water mark) between calls.
pub fn assert_chain_invariants(env: &Env, mint: &Pubkey, last: &mut Option<(u64, u64)>) {
    let l = env.launch(mint);
    let p = pdas(*mint);
    let pool = l.pool;
    let rent = env.vault_rent();
    assert_eq!(env.mint_supply(mint), pool.supply, "I9 mint supply == tracked supply");
    assert!(env.lamports(&p.reserve) as u128 >= rent as u128 + pool.reserve as u128 + pool.pending as u128, "I10 reserve vault funded");
    assert!(env.lamports(&p.curve) as u128 >= rent as u128 + pool.curve_lamports as u128, "I11 curve vault funded");
    assert_eq!(pool.curve_lamports + strata_math::limits::V_SOL_START, pool.v_sol, "I11 curve accounting");
    assert!(pool.supply != 0 || pool.reserve == 0, "I4 no reserve behind zero supply");
    assert!(pool.supply == 0 || pool.supply >= strata_math::limits::MIN_CIRCULATING_BASE, "I8 residual");
    let now = if pool.supply > 0 { Some((pool.reserve, pool.supply)) } else if pool.hwm_supply > 0 { Some((pool.hwm_reserve, pool.hwm_supply)) } else { None };
    if let (Some((r1, s1)), Some((r0, s0))) = (now, *last) {
        assert!(r1 as u128 * s0 as u128 >= r0 as u128 * s1 as u128, "I7 floor decreased: {r0}/{s0} -> {r1}/{s1}");
    }
    if now.is_some() {
        *last = now;
    }
}
