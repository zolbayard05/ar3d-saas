"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function readThemeFromDom(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/**
 * Reads/writes the `data-theme` attribute on <html> that styles/themes.css
 * keys its color overrides off of. The initial value is set synchronously
 * by the no-FOUC inline script in app/layout.tsx before hydration; this
 * hook just mirrors that into React state and persists changes.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Mirrors the data-theme attribute the no-FOUC inline script (see
    // app/layout.tsx) already set on <html> before hydration — this can't
    // be the useState lazy initializer instead because that runs during
    // SSR too, where `document` doesn't exist, which would desync the
    // server-rendered icon from the client's real theme on first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readThemeFromDom());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
