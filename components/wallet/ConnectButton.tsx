"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { IconCopy, IconWallet } from "@/components/icons";
import { shortAddress } from "@/lib/format";
import { useWalletDialog } from "./WalletProviders";

export function ConnectButton() {
  const { publicKey, connecting, disconnect, wallet } = useWallet();
  const { open } = useWalletDialog();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!publicKey) {
    return (
      <button type="button" className="btn btn-primary" onClick={open} disabled={connecting}>
        <IconWallet size={18} />
        <span>{connecting ? "Connecting…" : "Connect"}</span>
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div ref={root} className="relative">
      <button type="button" className="btn btn-secondary font-mono text-[13px]" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        {wallet?.adapter.icon && (
          // eslint-disable-next-line @next/next/no-img-element -- data URI icon
          <img src={wallet.adapter.icon} alt="" width={18} height={18} />
        )}
        {shortAddress(addr)}
      </button>
      {menu && (
        <div role="menu" className="raised absolute top-[calc(100%+8px)] right-0 z-50 grid w-56 gap-0.5 p-1.5">
          <button
            role="menuitem"
            type="button"
            className="btn btn-ghost btn-sm justify-start"
            onClick={async () => {
              await navigator.clipboard?.writeText(addr);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <IconCopy size={16} /> {copied ? "Copied" : "Copy address"}
          </button>
          <Link role="menuitem" href="/portfolio" className="btn btn-ghost btn-sm justify-start" onClick={() => setMenu(false)}>
            Portfolio
          </Link>
          <button
            role="menuitem"
            type="button"
            className="btn btn-ghost btn-sm justify-start text-rust"
            onClick={() => {
              setMenu(false);
              void disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
