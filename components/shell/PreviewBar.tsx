import { CLUSTER, PREVIEW, PROGRAMS_LIVE, SAMPLE_DATA, TESTNET } from "@/lib/config";

/**
 * Site-wide notice. In preview: programs not deployed and/or sample data.
 * Live on a test cluster: real transactions, but test SOL with no value.
 */
export function PreviewBar() {
  if (PREVIEW) {
    const parts = [
      !PROGRAMS_LIVE && "Strata's programs aren't deployed yet, so every transaction is simulated",
      SAMPLE_DATA && "figures are sample data",
    ].filter(Boolean);
    return (
      <Bar label="Preview">
        {parts.join("; ")}.
      </Bar>
    );
  }
  if (TESTNET) {
    return (
      <Bar label={CLUSTER === "localnet" ? "Localnet" : "Devnet"}>
        Strata is running on Solana {CLUSTER}: test SOL only, with no real value. Switch your wallet to {CLUSTER} and{" "}
        <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-2">
          get free test SOL
        </a>
        .
      </Bar>
    );
  }
  return null;
}

function Bar({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="note" className="border-b border-rule bg-well">
      <p className="frame py-2 font-mono text-xs leading-5 text-muted">
        <span className="mr-2 rounded-[3px] bg-[var(--accent-2-soft)] px-1.5 py-0.5 font-semibold text-rust">{label}</span>
        {children}
      </p>
    </div>
  );
}
