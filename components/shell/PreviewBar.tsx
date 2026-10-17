import { PREVIEW, PROGRAMS_LIVE, SAMPLE_DATA } from "@/lib/config";

/**
 * Site-wide notice in preview: programs not deployed and/or sample data.
 * The test-cluster notice lives in the footer.
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
