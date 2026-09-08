// @vitest-environment jsdom

import { THEME_PAIR_STORAGE_KEY, THEME_STORAGE_KEY } from "@ngriffin_uk/polychat-library-chat";
import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadStore() {
  vi.resetModules();

  const { useThemeStore } = await import("./themeStore.js");

  return useThemeStore;
}

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears storage when the choice returns to system", async () => {
    const store = await loadStore();

    store.getState().setPreference("plum");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("plum");

    store.getState().setPreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("restores a stored day and night pair and drops one with the wrong appearances", async () => {
    localStorage.setItem(THEME_PAIR_STORAGE_KEY, "paper:fern");

    expect((await loadStore()).getState().pair).toEqual({ light: "paper", dark: "fern" });

    localStorage.setItem(THEME_PAIR_STORAGE_KEY, "fern:paper");

    expect((await loadStore()).getState().pair).toEqual({ light: "light", dark: "dark" });
  });

  it("persists a chosen pair and clears storage when it returns to the default", async () => {
    const store = await loadStore();

    store.getState().setPair({ light: "dawn", dark: "plum" });
    expect(localStorage.getItem(THEME_PAIR_STORAGE_KEY)).toBe("dawn:plum");

    store.getState().setPair({ light: "light", dark: "dark" });
    expect(localStorage.getItem(THEME_PAIR_STORAGE_KEY)).toBeNull();
  });
});
