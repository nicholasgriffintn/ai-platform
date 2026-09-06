import {
  DEFAULT_THEME_PAIR,
  DEFAULT_THEME_PREFERENCE,
  isDefaultThemePair,
  isThemePreference,
  LEGACY_THEME_STORAGE_KEY,
  parseThemePair,
  serialiseThemePair,
  THEME_PAIR_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type ThemePair,
  type ThemePreference,
} from "@ngriffin_uk/polychat-component-ui";
import { create } from "zustand";

function persistPreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (preference === DEFAULT_THEME_PREFERENCE) {
      window.localStorage.removeItem(THEME_STORAGE_KEY);

      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

function persistPair(pair: ThemePair): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (isDefaultThemePair(pair)) {
      window.localStorage.removeItem(THEME_PAIR_STORAGE_KEY);

      return;
    }

    window.localStorage.setItem(THEME_PAIR_STORAGE_KEY, serialiseThemePair(pair));
  } catch {
    return;
  }
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isThemePreference(stored)) {
      return stored;
    }

    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);

    if (legacy === null) {
      return DEFAULT_THEME_PREFERENCE;
    }

    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);

    if (!isThemePreference(legacy)) {
      return DEFAULT_THEME_PREFERENCE;
    }

    persistPreference(legacy);

    return legacy;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function readStoredPair(): ThemePair {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PAIR;
  }

  try {
    return (
      parseThemePair(window.localStorage.getItem(THEME_PAIR_STORAGE_KEY)) ?? DEFAULT_THEME_PAIR
    );
  } catch {
    return DEFAULT_THEME_PAIR;
  }
}

export interface ThemeStore {
  preference: ThemePreference;
  pair: ThemePair;
  setPreference: (preference: ThemePreference) => void;
  setPair: (pair: ThemePair) => void;
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  preference: readStoredPreference(),
  pair: readStoredPair(),
  setPreference: (preference) => {
    persistPreference(preference);
    set({ preference });
  },
  setPair: (pair) => {
    persistPair(pair);
    set({ pair });
  },
}));
