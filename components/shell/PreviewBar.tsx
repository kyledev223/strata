import { PREVIEW, PROGRAMS_LIVE, SAMPLE_DATA } from "@/lib/config";

/** Site-wide notice while the programs aren't deployed or the data is sample data. */
export function PreviewBar() {
  if (!PREVIEW) return null;
  const parts = [
    !PROGRAMS_LIVE && "Strata's programs aren't deployed yet, so every transaction is simulated",
    SAMPLE_DATA && "figures are sample data",
  ].filter(Boolean);
  return (
    <div role="note" className="border-b border-rule bg-well">
      <p className="frame py-2 font-mono text-xs leading-5 text-muted">
        <span className="mr-2 rounded-[3px] bg-[var(--accent-2-soft)] px-1.5 py-0.5 font-semibold text-rust">Preview</span>
        {parts.join("; ")}.
      </p>
    </div>
  );
}
