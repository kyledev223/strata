import { CurveOnFloor, CurveToZero } from "@/components/art/Compare";
import { Lane, Lanes, LegendItem, SectionHead, Swatch } from "@/components/ui";

export function FigOne() {
  return (
    <section className="frame mt-24 max-sm:mt-18" aria-labelledby="fig1-title">
      <SectionHead
        plate="Fig. 1"
        id="fig1-title"
        title="One token, two launches"
        lede="Same buyers, same hype, same bad week. The only difference is what's underneath the price when they leave."
      />
      <figure className="m-0" aria-labelledby="fig1-title">
        <div className="sheet">
          <Lanes rows={3}>
            <Lane
              letter="A"
              labelId="fig1-lane-a"
              name="A standard bonding curve"
              verdict="No floor, no recourse"
              art={<CurveToZero />}
              legend={
                <>
                  <LegendItem swatch={Swatch.line("var(--text)")}>price on the way up</LegendItem>
                  <LegendItem swatch={Swatch.line("var(--accent-2)")}>on the way down</LegendItem>
                  <LegendItem swatch={Swatch.line("var(--accent-2)", true)}>nothing below</LegendItem>
                </>
              }
              rows={[
                { label: "Runs", text: "One curve. Every buy pushes the price up, and every sell pulls it down the same curve." },
                { label: "Holds", text: "SOL to pay sellers back down the curve, and nothing set aside for whoever is left holding." },
                { label: "If price falls", text: "It can fall all the way. The last holders sell into an empty curve, or can't sell at all." },
              ]}
            />
            <Lane
              featured
              letter="B"
              labelId="fig1-lane-b"
              name="A Strata floor launch"
              verdict="Floor that only rises"
              art={<CurveOnFloor />}
              legend={
                <>
                  <LegendItem swatch={Swatch.line("var(--text)")}>price</LegendItem>
                  <LegendItem swatch={Swatch.line("var(--accent)")}>floor</LegendItem>
                  <LegendItem swatch={Swatch.block("color-mix(in srgb, var(--accent) 35%, var(--surface))")}>SOL reserve</LegendItem>
                </>
              }
              rows={[
                { label: "Runs", text: "The same curve, plus a reserve vault. A share of every buy and the trading fee go into the vault." },
                { label: "Holds", text: "SOL in a vault per token, enough to buy back every circulating token at the floor." },
                { label: "If price falls", text: "It lands on the floor. Sellers route to redemption, get the floor in SOL, and the tokens burn." },
              ]}
            />
          </Lanes>
        </div>
      </figure>
    </section>
  );
}
