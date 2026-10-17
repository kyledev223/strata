"use client";

import { Plate } from "@/components/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="frame grid justify-items-start gap-4 pt-16 pb-8">
      <Plate>Error</Plate>
      <h1 className="type-h1">Couldn&rsquo;t read the chain</h1>
      <p className="max-w-[34rem] text-lead text-muted">The Solana RPC didn&rsquo;t answer. Your funds aren&rsquo;t affected; this page just couldn&rsquo;t load its data.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
