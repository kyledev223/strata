"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconArrowRight, IconSearch } from "@/components/icons";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function MintLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!BASE58.test(v)) return setError("That doesn't look like a Solana address.");
        router.push(`/token/${v}`);
      }}
    >
      <label htmlFor="mint" className="field-label">
        Mint address
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="input min-w-0 flex-1" data-invalid={error ? "" : undefined}>
          <IconSearch size={16} className="flex-none text-muted" />
          <input
            id="mint"
            className="font-mono text-sm"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-describedby="mint-help"
            placeholder="e.g. 3sxbS4zX…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="btn btn-primary h-11">
          Look up <IconArrowRight size={16} />
        </button>
      </div>
      <p id="mint-help" className={error ? "text-sm font-semibold text-rust" : "field-help"}>
        {error ?? "Base58, 32 to 44 characters."}
      </p>
    </form>
  );
}
