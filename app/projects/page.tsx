import type { Metadata } from "next";
import { ProjectsBoard } from "@/components/projects/ProjectsBoard";
import { Plate } from "@/components/ui";
import { getDataSource } from "@/lib/data";

export const metadata: Metadata = {
  title: "Projects",
  description: "Every Strata launch, its price and the floor underneath it.",
};

// Re-read stats at most once a minute (matters once the RPC data source is on).
export const revalidate = 60;

export default async function ProjectsPage() {
  const { tokens, asOf } = await getDataSource().listTokens({ sort: "reserve" });
  return (
    <div className="frame pt-7 lg:pt-10">
      <header className="mb-8 grid gap-4 lg:grid-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <Plate className="mb-3.5">Projects</Plate>
          <h1 className="type-h1">Every launch, and its floor</h1>
        </div>
        <p className="max-w-[34rem] text-lead text-muted lg:col-span-5 lg:col-start-8 lg:pb-1.5">
          Price on top, floor underneath. The green line is what the vault pays for each token today, and it only moves up.
        </p>
      </header>
      <ProjectsBoard tokens={tokens} asOf={asOf} />
    </div>
  );
}
