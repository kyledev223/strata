import type { Metadata } from "next";
import { Holdings } from "@/components/holdings/Holdings";
import { Plate } from "@/components/ui";
import { getDataSource } from "@/lib/data";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const holdings = await getDataSource().getHoldings("demo");
  return (
    <div className="frame pt-7 lg:pt-10">
      <header className="mb-8 grid gap-4 lg:grid-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <Plate className="mb-3.5">Portfolio</Plate>
          <h1 className="type-h1">What you hold, and what&rsquo;s under it</h1>
        </div>
        <p className="max-w-[34rem] text-lead text-muted lg:col-span-5 lg:col-start-8 lg:pb-1.5">
          Two numbers for every token: what the market pays, and what the vault guarantees.
        </p>
      </header>
      <Holdings holdings={holdings} mode="portfolio" />
    </div>
  );
}
