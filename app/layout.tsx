import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { Dock } from "@/components/shell/Dock";
import { WalletProviders } from "@/components/wallet/WalletProviders";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Strata: tokens with a floor", template: "%s · Strata" },
  description:
    "Launch Solana tokens backed by an on-chain SOL reserve. Anyone can redeem at the floor, any time, and the floor only goes up.",
};

export const viewport: Viewport = {
  // Black is the default theme; the toggle swaps this when someone picks light.
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

// Runs before paint: apply the saved theme (black by default) so there is no flash, then sync theme-color.
const themeInit = `(function(){try{var t=localStorage.getItem('strata-theme');if(t!=='light'&&t!=='dark'){t='dark'}var d=document.documentElement;d.dataset.theme=t;var c=t==='dark'?'#000000':'#EDE9E1';var s=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)})};s();document.addEventListener('DOMContentLoaded',s)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <WalletProviders>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Header />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer />
          <Dock />
        </WalletProviders>
      </body>
    </html>
  );
}
