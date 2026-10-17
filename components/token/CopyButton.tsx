"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-icon has-tip h-7! w-7! min-w-7!"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
    >
      {done ? <IconCheck size={14} className="text-accent" /> : <IconCopy size={14} />}
      <span className="tip" aria-hidden="true">
        {done ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
