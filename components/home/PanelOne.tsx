import {
  CreatorFeeArt,
  FeeToReserveArt,
  RedemptionDelayArt,
  ReserveShareArt,
  VestingArt,
} from "@/components/art/TileIcons";
import { IconArrowRight } from "@/components/icons";
import { ButtonLink, FigureName, SectionHead } from "@/components/ui";
import { bpsToPct, LIMITS } from "@/lib/limits";
import { FloorCalculator } from "./FloorCalculator";

const S = LIMITS.settings;
const maxDelayH = Math.max(...S.redemptionDelayHours.options);

const TILES = [
  { Art: ReserveShareArt, verb: "Reserve share", line: `Up to ${bpsToPct(S.reserveShareBps.max)}% of each buy goes to the vault before the curve sees it.` },
  { Art: FeeToReserveArt, verb: "Fee to reserve", line: "A trading fee on buys and sells, paid straight into the vault." },
  { Art: CreatorFeeArt, verb: "Creator fee", line: `Up to ${bpsToPct(S.creatorFeeBps.max)}% to the creator's wallet. Never taken from the reserve.` },
  { Art: VestingArt, verb: "Vesting on first buy", line: `The creator's opening buy unlocks a little each day, for up to ${S.vestingDays.max} days.` },
  { Art: RedemptionDelayArt, verb: "Redemption delay", line: `Open from the first block, or after a wait of up to ${maxDelayH >= 24 ? `${maxDelayH / 24} days` : `${maxDelayH} hours`}.` },
];

export function PanelOne() {
  return (
    <section className="frame mt-24 max-sm:mt-18" aria-labelledby="panel1-title">
      <SectionHead
        plate="Panel 1"
        id="panel1-title"
        title="Write the floor into the token."
        lede="Five settings, picked once at launch and stored on chain. Nobody can change them afterwards, including the creator."
      />
      <div className="sheet mt-8 grid gap-9 sm:pb-5">
        <div role="group" aria-labelledby="fig2-title" className="min-w-0">
          <FigureName plate="Fig. 2" id="fig2-title">
            What a launch can set
          </FigureName>
          <ul className="grid gap-3.5 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-7 xl:grid-cols-6 xl:gap-x-[18px]">
            {TILES.map(({ Art, verb, line }) => (
              <li key={verb} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 sm:grid-cols-1 sm:content-start sm:gap-y-3">
                <div className="well grid w-[112px] place-items-center px-2 py-1.5 sm:w-auto sm:p-2">
                  <Art />
                </div>
                <div className="grid min-w-0 content-start gap-1">
                  <p className="text-[15px] leading-[1.3] font-bold">{verb}</p>
                  <p className="text-sm leading-[1.4] text-pretty">{line}</p>
                </div>
              </li>
            ))}
            <li className="slab grid min-h-full content-center gap-1.5 px-[18px] pt-4 pb-[18px]">
              <p className="mb-1.5 justify-self-start rounded-[4px] bg-[color-mix(in_srgb,currentColor_16%,transparent)] px-2 py-[3px] font-mono text-xs font-semibold">
                Never
              </p>
              <p className="font-display text-xl leading-[1.08] font-extrabold [font-stretch:84%]">More than the reserve.</p>
              <p className="font-display text-xl leading-[1.08] font-extrabold [font-stretch:84%]">A team withdrawal.</p>
              <p className="mt-2 font-mono text-xs leading-4 text-balance opacity-75">The program checks every redemption against the vault.</p>
            </li>
          </ul>
        </div>

        <div role="group" aria-labelledby="fig3-title" className="hairline-top min-w-0 pt-7">
          <FigureName plate="Fig. 3" id="fig3-title">
            Floor math, worked
          </FigureName>
          <FloorCalculator />
        </div>
      </div>

      <div role="group" aria-labelledby="cta-title" className="raised mt-8 grid items-center gap-[18px] px-3.5 pt-4 pb-[18px] sm:px-6 sm:pt-5 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
        <div className="grid min-w-0 gap-2">
          <p id="cta-title" className="font-display text-2xl leading-[1.05] font-extrabold tracking-[-0.01em] [font-stretch:84%]">
            Put a floor under your launch
          </p>
          <p className="max-w-[60rem] text-[15px] leading-normal text-pretty">
            Pick a reserve share, a fee and a creator cut. Your token goes live with a vault from the first buy, and every trade
            after that adds to it. Launching costs {LIMITS.launch.launchFeeSol} SOL plus rent.
          </p>
        </div>
        <ButtonLink href="/launch" variant="primary" size="lg" className="justify-self-start lg:justify-self-end">
          Launch a token
          <IconArrowRight size={18} />
        </ButtonLink>
      </div>
    </section>
  );
}
