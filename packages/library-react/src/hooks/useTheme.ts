import {
  applyTheme,
  getThemeDefinition,
  resolveThemeId,
  SYSTEM_DARK_QUERY,
  type ThemeAppearance,
  type ThemeId,
  type ThemePair,
  type ThemePreference,
} from "@ngriffin_uk/polychat-library-chat";
import { useMediaQuery } from "@ngriffin_uk/polychat-utility-react";
import { useEffect } from "react";

import { useThemeStore } from "../state/stores/themeStore.js";

export function useThemePreference(): ThemePreference {
  return useThemeStore((state) => state.preference);
}

export function useSetThemePreference(): (preference: ThemePreference) => void {
  return useThemeStore((state) => state.setPreference);
}

export function useThemePair(): ThemePair {
  return useThemeStore((state) => state.pair);
}

export function useSetThemePair(): (pair: ThemePair) => void {
  return useThemeStore((state) => state.setPair);
}

export function useResolvedThemeId(): ThemeId {
  const preference = useThemeStore((state) => state.preference);
  const pair = useThemeStore((state) => state.pair);
  const prefersDark = useMediaQuery(SYSTEM_DARK_QUERY);

  return resolveThemeId(preference, prefersDark, pair);
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
