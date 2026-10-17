import type { Metadata } from "next";
import { Holdings } from "@/components/holdings/Holdings";
import { Plate } from "@/components/ui";
import { getDataSource } from "@/lib/data";

export const metadata: Metadata = {
  title: "Redeem",
  description: "Hand tokens back to the vault at the floor price. They're burned and you're paid in SOL.",
};

export default async function RedeemPage() {
  // TODO(phase 2): holdings come from the connected wallet, client-side.
  const holdings = await getDataSource().getHoldings("demo");
  return (
    <div className="frame pt-7 lg:pt-10">
      <header className="mb-8 grid gap-4 lg:grid-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <Plate className="mb-3.5">Redeem</Plate>
          <h1 className="type-h1">Hand it back at the floor</h1>
        </div>
        <p className="max-w-[34rem] text-lead text-muted lg:col-span-5 lg:col-start-8 lg:pb-1.5">
          Any token, any time after its redemption opens. The tokens burn, the vault pays the floor in SOL, and the
          floor for everyone else stays put.
        </p>
      </header>
      <Holdings holdings={holdings} mode="redeem" />
    </div>
  );
}
