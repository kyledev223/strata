"use client";

import { useSyncExternalStore } from "react";
import { IconMoon, IconSun } from "@/components/icons";

type Theme = "light" | "dark";
const COLORS: Record<Theme, string> = { light: "#EDE9E1", dark: "#141412" };

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", COLORS[theme]));
}

// The init script resolves the theme before paint; this just observes <html data-theme>.
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const getServerTheme = (): Theme | null => null;

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon has-tip"
      aria-label={theme ? `Switch to ${next} mode` : "Switch colour theme"}
      onClick={() => {
        apply(next);
        try {
          localStorage.setItem("strata-theme", next);
        } catch {}
      }}
    >
      {/* Both icons render; CSS picks one so server and client markup match. */}
      <IconMoon className="dark:hidden" />
      <IconSun className="hidden dark:block" />
      <span className="tip" aria-hidden="true">
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}
