import {
  applyTheme,
  getThemeDefinition,
  resolveThemeId,
  SYSTEM_DARK_QUERY,
  useMediaQuery,
  type ThemeAppearance,
  type ThemeId,
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

export function useResolvedThemeId(): ThemeId {
  const preference = useThemeStore((state) => state.preference);
  const prefersDark = useMediaQuery(SYSTEM_DARK_QUERY);

  return resolveThemeId(preference, prefersDark);
}

export function useThemeAppearance(): ThemeAppearance {
  return getThemeDefinition(useResolvedThemeId()).appearance;
}

export function useApplyTheme(): void {
  const id = useResolvedThemeId();

  useEffect(() => {
    applyTheme(document.documentElement, id);
  }, [id]);
}
