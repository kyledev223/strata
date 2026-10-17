# Strata

Marketing site and launch UI for Strata, a Solana launchpad where every token has an on-chain SOL reserve and a floor that only goes up.

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

Copy `.env.example` to `.env.local` to set the RPC endpoint or switch data sources.

## Layout

| Path | What |
|---|---|
| `LAYOUT.md` | Section-by-section structure notes from the reference study |
| `app/globals.css` | Palette tokens (light + dark), Tailwind mapping, type scale, catalogue primitives (`.sheet`, `.plate`, `.raised`, `.rows`, `.quote`) |
| `components/ui.tsx` | Design system: `Plate`, `SectionHead`, `FigureName`, `Panel`, `Stat`, `Callout`, `Lanes`/`Lane`, `SolPrice` |
| `components/art/` | Original SVG figures: hero plinth, Fig. 1 charts, Fig. 2 pictograms |
| `components/home/` | Homepage sections, including the Fig. 3 floor calculator |
| `components/token/` | Token card, glyph, sparkline, price/floor chart, trade panel |
| `lib/floor.ts` | Floor math: `quoteBuy`, `quoteSell`, `quoteExit`, `redeem`, `startingFloor` |
| `lib/data/` | `StrataDataSource` interface, deterministic mock, RPC stub |
| `lib/strata/actions.ts` | `launchToken`, `buy`, `sell`, `redeemAtFloor` stubs with Anchor TODOs |
| `lib/programs.ts` | Program IDs (placeholders) |

## Swapping in real data

Everything the UI reads goes through `getDataSource()` in `lib/data/index.ts`. Set
`NEXT_PUBLIC_STRATA_DATA=rpc` and implement the four methods in `lib/data/rpc.ts`; each has a
comment naming the accounts it should read. Return shapes match the mock, so no UI changes
are needed.

## Wiring the programs (phase 2)

Search for `TODO(phase 2)`. The forms already call `lib/strata/actions.ts` with validated
input and slippage limits; replace each stub body with the Anchor call. Program IDs in
`lib/programs.ts` are freshly generated placeholder keys with nothing deployed at them.

## Protocol rules the UI assumes

These are encoded in `lib/floor.ts` and should match the programs:

- **Buys** never dilute the floor: the reserve deposit is the larger of the reserve share and
  `floor × tokens minted`.
- **Sells** route to whichever pays more: the curve until its price reaches the floor, then
  redemption at the floor for the rest, in one transaction. So price can't trade below the floor.
- **Redemption** pays `tokens × floor`, rounded down to the lamport, and burns the tokens. It has no fee.
- **Fees to reserve** only add SOL, so the floor only rises.
- Launch fee is shown as 0.02 SOL plus rent (placeholder).

## Deploying a preview

Vercel is the simplest host (any Node host that runs `next start` works). Set these environment variables:

| Variable | Value | Effect |
|---|---|---|
| `PREVIEW_PASSWORD` | any string | Optional. Every page asks for it (any username). Icons, build assets and `robots.txt` stay public. Unset = no gate. |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` | Absolute URLs for share cards, the sitemap and robots.txt. Falls back to the Vercel production URL. |
| `NEXT_PUBLIC_SOLANA_RPC` | RPC URL | Use a paid endpoint before real traffic; the public one rate-limits. |
| `NEXT_PUBLIC_STRATA_DATA` | `mock` / `rpc` | Leave `mock` until `lib/data/rpc.ts` is implemented. |
| `NEXT_PUBLIC_PROGRAMS_LIVE` | `false` / `true` | `true` only once the programs are deployed. |

While the data is `mock` or the programs aren't live, the site is in **preview mode**:
- A notice runs across the top of every page.
- `robots.txt` disallows crawling and every page carries `noindex`.
- The footer, docs and explorer hide the placeholder program addresses.

GitHub and X links stay hidden until `LINKS` in `lib/programs.ts` points at real accounts.

## Wallets

Phantom and Solflare use explicit adapters. Backpack's adapter package is deprecated, so it
(and any other Wallet Standard wallet) is detected automatically by `@solana/wallet-adapter-react`.
