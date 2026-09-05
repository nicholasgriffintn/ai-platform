import { oklchToHex, parseOklch } from "@ngriffin_uk/polychat-utility-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  LEGACY_THEME_STORAGE_KEY,
  resolveThemeId,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
} from "./theme";

import stylesheet from "./styles.css?raw";

function readThemeBlocks(): Map<string, string> {
  const blocks = new Map<string, string>();
  const pattern = /\[data-polychat-theme="([a-z]+)"\]\s*\{([^}]*)\}/g;

  for (const match of stylesheet.matchAll(pattern)) {
    blocks.set(match[1], match[2]);
  }

  return blocks;
}

function readToken(block: string, token: string): string {
  const match = new RegExp(`--polychat-${token}:\\s*([^;]+);`).exec(block);

  if (!match) {
    throw new Error(`Missing --polychat-${token}`);
  }

  return match[1].trim();
}

function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: prefersDark && query.includes("dark"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function runBootstrap(): { theme: string | undefined; classes: string[]; color: string | null } {
  const meta = document.createElement("meta");

  meta.setAttribute("name", "theme-color");
  document.head.append(meta);
  new Function(THEME_BOOTSTRAP_SCRIPT)();

  const root = document.documentElement;

  return {
    theme: root.dataset.polychatTheme,
    classes: [...root.classList].sort(),
    color: meta.getAttribute("content"),
  };
}

function expectedFor(id: ThemeId) {
  const owner = document.implementation.createHTMLDocument();
  const meta = owner.createElement("meta");

  meta.setAttribute("name", "theme-color");
  owner.head.append(meta);
  applyTheme(owner.documentElement, id);

  return {
    theme: owner.documentElement.dataset.polychatTheme,
    classes: [...owner.documentElement.classList].sort(),
    color: meta.getAttribute("content"),
  };
}

describe("theme registry", () => {
  it("has one token block per registered theme and no orphan blocks", () => {
    const blocks = readThemeBlocks();

    expect([...blocks.keys()].sort()).toEqual(THEMES.map((theme) => theme.id).sort());

    for (const theme of THEMES) {
      const block = blocks.get(theme.id);

      expect(block, theme.id).toBeDefined();
      expect(readToken(block ?? "", "canvas")).toMatch(/^oklch\(/);
      expect(block).toContain(`color-scheme: ${theme.appearance};`);
    }
  });

  it("declares a theme colour that matches each canvas token", () => {
    const blocks = readThemeBlocks();

    for (const theme of THEMES) {
      const canvas = parseOklch(readToken(blocks.get(theme.id) ?? "", "canvas"));

      expect(canvas, theme.id).not.toBeNull();
      expect(oklchToHex(canvas ?? { lightness: 0, chroma: 0, hue: 0 }), theme.id).toBe(
        theme.themeColor,
      );
    }
  });
});

describe("theme bootstrap", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    document.head.querySelector('meta[name="theme-color"]')?.remove();
    document.documentElement.removeAttribute("data-polychat-theme");
    document.documentElement.className = "";
  });

  it.each([
    ["plum", false],
    ["paper", true],
    ["system", true],
    ["system", false],
    ["nonsense", true],
  ])("resolves %s with prefers-dark %s exactly as the runtime does", (stored, prefersDark) => {
    stubMatchMedia(prefersDark);
    localStorage.setItem(THEME_STORAGE_KEY, stored);

    const preference = THEMES.some((theme) => theme.id === stored) ? (stored as ThemeId) : "system";

    expect(runBootstrap()).toEqual(expectedFor(resolveThemeId(preference, prefersDark)));
  });

  it("honours the pre-registry storage key until the store migrates it", () => {
    stubMatchMedia(false);
    localStorage.setItem(LEGACY_THEME_STORAGE_KEY, "dark");

    expect(runBootstrap()).toEqual(expectedFor("dark"));
  });
});
