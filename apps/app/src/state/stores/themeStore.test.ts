import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from "@ngriffin_uk/polychat-component-ui";
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadStore() {
  vi.resetModules();

  const { useThemeStore } = await import("./themeStore");

  return useThemeStore;
}

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates a choice saved under the pre-registry key exactly once", async () => {
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "dark");

    const store = await loadStore();

    expect(store.getState().preference).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
  });

  it("drops an unknown legacy value and falls back to system", async () => {
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "sepia");

    const store = await loadStore();

    expect(store.getState().preference).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
  });

  it("prefers the current key over a stale legacy value", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "fern");
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "light");

    const store = await loadStore();

    expect(store.getState().preference).toBe("fern");
  });

  it("clears storage when the choice returns to system", async () => {
    const store = await loadStore();

    store.getState().setPreference("plum");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("plum");

    store.getState().setPreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
