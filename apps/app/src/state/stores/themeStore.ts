import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@ngriffin_uk/polychat-component-ui";
import { create } from "zustand";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

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

export interface ThemeStore {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  preference: readStoredPreference(),
  setPreference: (preference) => {
    persistPreference(preference);
    set({ preference });
  },
}));
