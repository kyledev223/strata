"use client";

import { useEffect, useId, useRef } from "react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { IconArrowRight, IconArrowUpRight, IconClose } from "@/components/icons";
import { cx } from "@/components/ui";

const KNOWN = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/downloads" },
] as const;

export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { wallets, select, connecting } = useWallet();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const detected = (name: string) =>
    wallets.find(
      (w) =>
        w.adapter.name === name &&
        (w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable),
    );
  const extras = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed && !KNOWN.some((k) => k.name === w.adapter.name),
  );
  const anyDetected = KNOWN.some((k) => detected(k.name)) || extras.length > 0;

  const choose = (name: string) => {
    // autoConnect on the provider connects as soon as a wallet is selected.
    select(name as WalletName);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
      <div className="dialog-panel raised max-w-[400px]">
        <div className="hairline-bottom flex items-start justify-between gap-4 pt-4 pr-3 pb-3.5 pl-5">
          <h2 id={titleId} className="pt-1 font-display text-[26px] leading-[1.02] font-extrabold tracking-[-0.01em] [font-stretch:80%]">
            Connect a wallet
          </h2>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Close" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto overscroll-contain p-5">
          <p className="text-sm leading-[1.45]">
            {anyDetected ? "Pick a wallet to connect. Strata never asks for your seed phrase." : "No Solana wallet found in this browser."}
          </p>
          <ul className="grid gap-2.5">
            {KNOWN.map((k) => {
              const w = detected(k.name);
              const icon = w?.adapter.icon ?? wallets.find((x) => x.adapter.name === k.name)?.adapter.icon;
              const body = (
                <>
                  <WalletIcon name={k.name} src={icon} />
                  <span className="min-w-0 flex-1 text-base leading-[1.3] font-[650]">{k.name}</span>
                  <span className={cx("inline-flex flex-none items-center gap-1.5 text-xs font-medium", w ? "text-accent" : "text-muted")}>
                    {w ? (
                      <>
                        {w.readyState === WalletReadyState.Installed ? "Detected" : "Connect"} <IconArrowRight size={14} />
                      </>
                    ) : (
                      <>
                        Get it <IconArrowUpRight size={14} />
                      </>
                    )}
                  </span>
                </>
              );
              return (
                <li key={k.name}>
                  {w ? (
                    <button type="button" className={rowCls} disabled={connecting} onClick={() => choose(k.name)}>
                      {body}
                    </button>
                  ) : (
                    <a className={rowCls} href={k.url} target="_blank" rel="noreferrer">
                      {body}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </li>
              );
            })}
            {extras.map((w) => (
              <li key={w.adapter.name}>
                <button type="button" className={rowCls} onClick={() => choose(w.adapter.name)}>
                  <WalletIcon name={w.adapter.name} src={w.adapter.icon} />
                  <span className="min-w-0 flex-1 text-base leading-[1.3] font-[650]">{w.adapter.name}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
                    Detected <IconArrowRight size={14} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-rule-strong after:h-px after:flex-1 after:bg-rule-strong">
            <span>New to Solana?</span>
          </div>
          <a className={rowCls} href="/docs#wallets">
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-[var(--accent-soft)] font-mono text-sm font-semibold text-accent">?</span>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="text-base leading-[1.3] font-[650]">How wallets work</span>
              <span className="text-xs leading-[1.4] text-muted">Two minutes, then come back and connect</span>
            </span>
            <IconArrowRight size={16} />
          </a>
        </div>
      </div>
      )}
    </dialog>
  );
}

const rowCls =
  "flex w-full min-h-[60px] cursor-pointer items-center gap-3 rounded-[6px] border border-rule-strong bg-transparent py-2.5 pr-3.5 pl-3 text-left text-inherit no-underline transition-colors hover:bg-well disabled:cursor-default disabled:opacity-55";

function WalletIcon({ name, src }: { name: string; src?: string }) {
  return (
    <span className="grid size-9 flex-none place-items-center overflow-hidden rounded-lg bg-well">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- wallet icons are data URIs
        <img src={src} alt="" width={32} height={32} className="size-8 object-contain" />
      ) : (
        <span aria-hidden="true" className="font-mono text-sm font-semibold">
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
