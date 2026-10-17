import { Suspense } from "react";
import { FigOne } from "@/components/home/FigOne";
import { Hero } from "@/components/home/Hero";
import { Ledger, LedgerSkeleton } from "@/components/home/Ledger";
import { PanelOne } from "@/components/home/PanelOne";

// Re-read stats at most once a minute (matters once the RPC data source is on).
export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <section className="pt-7 lg:pt-10" aria-labelledby="home-title">
        <div className="frame">
          <Hero />
          <Suspense fallback={<LedgerSkeleton />}>
            <Ledger />
          </Suspense>
        </div>
      </section>
      <FigOne />
      <PanelOne />
    </>
  );
}
