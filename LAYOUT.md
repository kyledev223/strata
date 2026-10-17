# Strata layout notes

Structural study of the reference (bordrless.app `/`, `/launch`, `/projects`, `/docs`).
These notes cover layout only: grid, spacing, hierarchy and component anatomy. Copy, names,
artwork and palette are ours.

## Global frame

| Token | Value | Notes |
|---|---|---|
| Frame max | 1360px content + 2 × gutter | `.frame`, centred |
| Gutter | 16px → 24px (≥40rem) → 40px (≥64rem) | Respects safe-area insets |
| Grid | 12 columns, 24px column gap | Used by hero, section heads, footer |
| Header height | 60px → 72px (≥64rem) | Sticky, 1px bottom rule |
| Section rhythm | 96px between major sections (72px under 40rem) | Hero is 28px → 40px from header |
| Radius | 4px controls, 6px surfaces | Nearly square, catalogue feel |
| Elevation | 2px hard offset shadow (no blur) on raised surfaces | "Plinth" look; we keep a hairline version |

**Type scale** (fluid `clamp`): display 56→104px / lh .92; h1 44→72px / lh .95; h2 32→44px / lh 1;
h3 22→28px; lead 18→20px; body 16px / 1.5; small 14px; label 12px mono.
Display and headings: extra-bold (800) condensed grotesque, tight negative tracking.
Labels, figures, plates and addresses: 12–13px semibold monospace.

**Label primitives**
- *Plate*: mono 12–13px semibold chip with a 14% ink tint, 24–28px tall. Used for "Fig. 1", "Panel 1".
- *Number badge*: 24×24 mono chip ("1", "A"), solid tint for the featured option, 6% tint for the baseline.
- *Verdict tag*: mono chip at the right of a lane head ("Approves or blocks").
- *Hairline rows*: `dt` mono 12px in a 76px column, `dd` 15px text, 1px rule on top of each row.

## Shell

**Header** (sticky): brand mark + wordmark · primary places (icon + label, 2px underline on the
active place, flush with header bottom) · secondary icon buttons with tooltips (Explorer, Docs,
Portfolio) · right cluster: Connect (primary, solid), dark-mode icon toggle.
Nav collapses below 60rem. The reference uses a bottom dock on mobile; we use a bottom dock too
(icon + label, 5 items).

**Footer** ("plinth", inverted dark band): 12-col grid.
- Brand block (cols 1–5): mark + big wordmark + one-sentence line (max 30rem).
- Places (cols 7–8): mono label, vertical link list.
- Programs on mainnet (cols 10–12): mono label, rows of `Name ·········· Addr…ess` with a dotted
  leader between name and short address, each linking to Solscan.
- Base row under a hairline: GitHub link + X icon.

**Wallet dialog**: native `<dialog>`, 400px panel. Head: title + close icon, hairline under.
Body: status line ("No wallet found…"), list of 60px wallet rows (icon 36px · name · status
"Get it ↗" or "Detected"), then a hairline divider with centred caption.

## Homepage

1. **Hero** (12-col): copy in cols 1–5, art in cols 6–12.
   - Copy: mono kicker chip → display headline (2 lines) → muted h2-size counter-line →
     inverted "answer" slab → 2px top-ruled one-liner → actions (primary, secondary, full-width third).
   - Art ("anatomy" figure), its own container grid: stage (1.75fr) + numbered parts column
     (min 220px, 1fr), 64px gap. Parts: number badge + mono location word, 21px condensed title,
     15px body. Leader lines (SVG) run from each part to a dot on the illustration.
     Under the parts sits a **spec label** (raised card: title over a hairline, then a `dl` with an
     84px mono `dt` column: "Keeps" / "Called by").
   - Under 520px container width: parts and leaders hide, spec label shows, art goes full width.

2. **Ledger** (below hero, 40px gap): two raised panels side by side (≥68rem), each with a
   panel head (21px condensed title + "Live" status dot on the first), then a 3-up `figures`
   grid (mono label 12px muted over a 28px mono tabular value).

3. **Fig. 1 exhibit**: section head = plate + h1 (cols 1–7), optional lede (cols 8–12).
   Figure "sheet": 2px ink border, surface fill, L-shaped 4px corner brackets top-left and
   bottom-right, 28px padding. Two lanes (A | B) on a 6-row **subgrid** so heads, art, legend
   and each of the 3 rows align across lanes; a 1px vertical rule separates them (48→64px gap).
   Lane: head (badge + name, verdict chip right, 2px ink rule under) → recessed art well →
   mono legend with keys → 3 hairline `dl` rows.

4. **Panel 1** section: plate + h1. One sheet with two stacked figures:
   - **Fig. 2** title bar (plate + 22px condensed name, 2px rule under) → tile list:
     1 col (mobile, icon left) → 3 col (≥40rem) → 6 col (≥80rem). Each tile: recessed icon well,
     bold verb, one-line description. The last cell is the inverted **"Never"** box: mono chip
     head, 2–3 condensed 20px lines, a muted mono footnote.
   - **Fig. 3** (separated by a hairline): another A/B lane comparison.
   - Then the closing **build band**: raised panel, title + line on the left, CTA right (≥64rem).

## /launch

`frame` with 24–40px top padding. Form grid 8fr | 4fr (≥64rem):
- Row 1 col 1: centred step bar (numbered buttons: 1 Token · 2 Rules · 3 Review).
- Row 2 col 1: raised panel sections (panel head + fields). Token grid: picture drop well (5fr)
  beside name/ticker (6fr). Fields: 15px semibold label, mono counter/aside on the right, 14px muted help.
- Row 2 col 2: sticky aside "Your card on the board" (mono caption) holding a live preview card.
- Step nav: back/next row. Confirm `<dialog>` (720px) with quote rows (label ···· value with dotted leaders).

## /projects

Board: optional pinned slab card → toolbar (search input, status segmented control, sort select,
view toggle) → card grid `repeat(auto-fill, minmax(288px, 1fr))`, 24px gap.
Card: 88px thumb + name (26px condensed) / mono ticker / status dot; 3-up small figures;
foot under a hairline with a rules summary and fee chip.

## /docs (reference only, not built in phase 1)

Three-column frame at ≥80rem: 224px nav · article · 224px on-page TOC (56px gaps);
two columns at ≥64rem; a collapsible sticky nav bar on mobile.

## How Strata maps onto it

| Reference | Strata |
|---|---|
| Sculpture with 4 numbered parts | SVG stepped stone plinth with a rising floor line, parts 1–4: curve, vault, floor, redemption |
| Spec label "Keeps / Called by" | "Holds / Called by" |
| Ledger: now / all time | "On Strata now" (Launches, SOL in reserves, Volume 24h) / "All time" (Floors raised, Redeemed & burned, Fees to reserves) |
| Fig. 1 two standards | "One token, two launches": A bonding curve vs B floor launch; rows Runs / Holds / If price falls |
| Fig. 2 tiles + Never | "What a launch can set": 5 tiles + Never box |
| Fig. 3 A/B lanes | Interactive floor calculator, same sheet styling |
| Build band | Closing CTA panel |
| Palette | Stone paper + verdigris accent + rust for burns/warnings (see `app/globals.css`) |
