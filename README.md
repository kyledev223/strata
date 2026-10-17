# Strata

Strata is a Solana launchpad where every token has an on-chain SOL reserve and a floor that only goes up. This repo has the website (Next.js) and the on-chain program (Anchor, in `program/`).

```
floor = reserve_SOL / circulating_supply
```

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
npm run lint
```

Copy `.env.example` to `.env.local` to choose the cluster, RPC and data source. With no env at all the site runs on sample data in preview mode.

## Layout

| Path | What |
|---|---|
| `LAYOUT.md` | Section-by-section structure notes from the reference study |
| `app/globals.css` | Palette tokens (light + dark), Tailwind mapping, type scale, catalogue primitives (`.sheet`, `.plate`, `.raised`, `.rows`, `.quote`) |
| `components/ui.tsx` | Design system: `Plate`, `SectionHead`, `FigureName`, `Panel`, `Stat`, `Callout`, `Lanes`/`Lane`, `SolPrice` |
| `components/art/` | Original SVG figures: hero plinth, Fig. 1 charts, Fig. 2 pictograms |
| `components/home/` | Homepage sections, including the Fig. 3 floor calculator |
| `components/token/` | Token card, glyph, sparkline, price/floor chart, trade panel |
| `lib/floor.ts` | Floor math for quotes, mirroring the program: `quoteBuy`, `quoteExit`, `redeem`, `startingFloor` |
| `lib/data/` | `StrataDataSource` interface, deterministic mock, and `rpc.ts`, which reads the program directly |
| `lib/strata/` | `client.ts` (PDAs, instruction builders), `actions.ts` (transactions), `idl/` (generated) |
| `lib/programs.ts` | Addresses shown on the site (program ID from the IDL, treasury from config) |
| `app/api/` | `upload` (Pinata), `holdings` (a wallet's Strata tokens) |
| `program/` | The Anchor workspace: `crates/strata-math`, `programs/strata`, `tests`, `scripts` |
| `PROGRAM_SPEC.md` | The program spec, decisions, attack analysis and test results |

## The program

```
program/
  crates/strata-math   exact integer floor math + property tests (limits generated from config/limits.json)
  programs/strata      the Anchor program
  tests                LiteSVM integration tests + stateful fuzz
  scripts              build.sh, test.sh, localnet.sh, deploy-devnet.sh, fetch-fixtures.sh
```

Needs Linux or WSL with Rust, the Solana/Agave CLI and Anchor 1.2.1.

```bash
cd program
scripts/build.sh          # anchor build --arch v0, copies the IDL into lib/strata/idl
scripts/test.sh           # math properties + LiteSVM integration tests
scripts/localnet.sh       # local validator with strata + Metaplex on :8899
scripts/deploy-devnet.sh  # needs the program keypair and ~5 devnet SOL
```

Build for **SBPF v0**. Anchor 1.2 defaults to v3, which devnet and mainnet don't run yet.

### Mainnet

1. Put the real treasury address in `config/limits.json` (`launch.treasury`). It's compiled into the program.
2. Fund the CLI wallet (`solana address`) with ~4–5 SOL.
3. `CONFIRM_MAINNET=yes RPC_URL=<private mainnet RPC> TREASURY_CONFIRM=<treasury> program/scripts/deploy-mainnet.sh`
   builds, runs every test, records the binary's SHA-256 and deploys. The program stays upgradeable for now.
4. Set the Vercel variables for `mainnet-beta`, redeploy the site, and smoke-test with small amounts.
5. `CONFIRM_FINAL=yes RPC_URL=... program/scripts/finalize-mainnet.sh` checks the on-chain binary matches
   the build and makes the program immutable. **Irreversible**: no fixes after this, by anyone.

## Protocol rules

Enforced by the program and mirrored in `lib/floor.ts` (details in `PROGRAM_SPEC.md`):

- **Buys** back every new token at the floor, or fail.
- **Sells** go to the curve while it pays at least the floor after fees; the rest is redeemed in the same transaction.
- **Redemption** pays `tokens × reserve / supply`, rounded down to the lamport, and burns the tokens. No fee.
- **Fees** are taken in SOL and never come from the reserve. Surplus above backing drips into the reserve over ~150 slots.
- **The floor never decreases**: checked on chain at the end of every instruction.
- After any trade, circulating supply is zero or at least 1,000 tokens.

## Deploying a preview

Vercel is the simplest host (any Node host that runs `next start` works). Set these environment variables:

| Variable | Value | Effect |
|---|---|---|
| `PREVIEW_PASSWORD` | any string | Optional. Every page asks for it (any username). Icons, build assets and `robots.txt` stay public. Unset = no gate. |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` | Absolute URLs for share cards, the sitemap and robots.txt. Falls back to the Vercel production URL. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` / `mainnet-beta` / `localnet` | Which cluster; explorer links follow it. |
| `NEXT_PUBLIC_SOLANA_RPC` | RPC URL | Defaults to the cluster's public RPC. Use a paid one for anything public. |
| `NEXT_PUBLIC_STRATA_DATA` | `mock` / `rpc` | `rpc` reads the program on the cluster above. |
| `NEXT_PUBLIC_PROGRAMS_LIVE` | `false` / `true` | `true` once the program is deployed on that cluster. |
| `PINATA_JWT`, `PINATA_GATEWAY` | Pinata credentials | Optional. Enables token picture uploads. |

**Going live on devnet:** deploy the program (`program/scripts/deploy-devnet.sh`), then set `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`, `NEXT_PUBLIC_STRATA_DATA=rpc`, `NEXT_PUBLIC_PROGRAMS_LIVE=true` and a devnet RPC, and redeploy the site.

While the data is `mock` or the programs aren't live, the site is in **preview mode**:
- A notice runs across the top of every page.
- `robots.txt` disallows crawling and every page carries `noindex`.
- The footer, docs and explorer hide the placeholder program addresses.

GitHub and X links stay hidden until `LINKS` in `lib/programs.ts` points at real accounts.

## Wallets

Phantom and Solflare use explicit adapters. Backpack's adapter package is deprecated, so it
(and any other Wallet Standard wallet) is detected automatically by `@solana/wallet-adapter-react`.
