import {
  applyTheme,
  resolveThemeId,
  SYSTEM_DARK_QUERY,
  type ThemePreference,
} from "@ngriffin_uk/polychat-component-ui";
import { useEffect } from "react";

import { useThemeStore } from "~/state/stores/themeStore";

export function useThemePreference(): ThemePreference {
  return useThemeStore((state) => state.preference);
}

export function useSetThemePreference(): (preference: ThemePreference) => void {
  return useThemeStore((state) => state.setPreference);
}

export function useApplyTheme(): void {
  const preference = useThemeStore((state) => state.preference);

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const apply = () => {
      applyTheme(document.documentElement, resolveThemeId(preference, media.matches));
    };

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [preference]);
}
