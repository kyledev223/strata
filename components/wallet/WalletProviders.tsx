"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { RPC_ENDPOINT } from "@/lib/config";
import { WalletDialog } from "./WalletDialog";

const DialogContext = createContext<{ open: () => void }>({ open: () => {} });

/** Open the wallet dialog from anywhere ("Connect to buy", etc). */
export const useWalletDialog = () => useContext(DialogContext);

export function WalletProviders({ children }: { children: ReactNode }) {
  // Phantom and Solflare get explicit adapters. Backpack (and any other wallet
  // that implements Wallet Standard) is detected automatically by the provider.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const ctx = useMemo(() => ({ open }), [open]);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <DialogContext.Provider value={ctx}>
          {children}
          <WalletDialog open={isOpen} onClose={() => setOpen(false)} />
        </DialogContext.Provider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
