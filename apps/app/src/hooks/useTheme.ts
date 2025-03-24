import { useEffect, useState } from "react";

import type { Theme } from "~/types";

export function useTheme() {
  if (typeof window === "undefined") {
    return ["system", () => {}];
  }

  const [theme, setTheme] = useState<Theme>(
    () => (window.localStorage.getItem("theme") as Theme) || "system",
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    const effectiveTheme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    root.classList.add(effectiveTheme);
    theme === "system"
      ? window.localStorage.removeItem("theme")
      : window.localStorage.setItem("theme", theme);
  }, [theme]);

  return [theme, setTheme] as const;
}
