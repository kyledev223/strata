import type { Metadata } from "next";
import { MintLookup } from "@/components/explorer/MintLookup";
import { Panel, Plate } from "@/components/ui";
import { shortAddress, solscanAccount } from "@/lib/format";
import { PROGRAM_LIST } from "@/lib/programs";

export const metadata: Metadata = { title: "Explorer" };

export default function ExplorerPage() {
  return (
    <div className="frame pt-7 lg:pt-10">
      <header className="mb-8">
        <Plate className="mb-3.5">Explorer</Plate>
        <h1 className="type-h1">Look up a launch</h1>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Panel title="By mint address" titleId="lookup-title" note="Paste a token's mint to see its reserve, floor and settings.">
          <MintLookup />
        </Panel>
        <Panel title="Programs" titleId="programs-title" note="Placeholder addresses until deploy.">
          <dl className="quote">
            {PROGRAM_LIST.map((p) => (
              <div key={p.address}>
                <dt>{p.name}</dt>
                <dd>
                  <a href={solscanAccount(p.address)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {shortAddress(p.address)}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
