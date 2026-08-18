import type { Page } from "@playwright/test";
import type { VisualSnapshotOptions } from "playwright-visual-cloud";
import { expect } from "playwright-visual-cloud";

export type ColourScheme = "light" | "dark";

export type SnapshotViewport = {
  width: number;
  height: number;
  name: string;
};

export type VisualCheckpointOptions = {
  fullPage?: boolean;
  viewports?: readonly SnapshotViewport[];
  colorSchemes?: readonly ColourScheme[];
  snapshotOptions?: Omit<VisualSnapshotOptions, "fullPage" | "variant">;
};

export const DYNAMIC_COPY_SELECTORS = ["[data-dynamic-copy]"];

export const DEFAULT_VISUAL_CHECKPOINTS = {
  fullPage: true,
  viewports: [
    { name: "desktop", width: 1280, height: 720 },
    { name: "mobile", width: 390, height: 844 },
  ],
  colorSchemes: ["light", "dark"] as const,
} as const;

const DEFAULT_VIEWPORTS: SnapshotViewport[] = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
];

const DEFAULT_SCHEMES: ColourScheme[] = ["light", "dark"];

function canCaptureVisualSnapshot(): boolean {
  if (!process.env.PVC_SERVER_URL || !process.env.PVC_TOKEN) {
    return false;
  }

  return true;
}

type ThemeState = {
  hasDarkThemeClass: boolean;
  hasLightThemeClass: boolean;
  storedTheme: string | null;
};

async function getThemeState(page: Page): Promise<ThemeState> {
  return page.evaluate(() => ({
    hasDarkThemeClass: document.documentElement.classList.contains("dark"),
    hasLightThemeClass: document.documentElement.classList.contains("light"),
    storedTheme: window.localStorage.getItem("theme"),
  }));
}

async function setThemeAndMediaForScheme(page: Page, scheme: ColourScheme): Promise<void> {
  await page.evaluate((nextScheme) => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(nextScheme);
    window.localStorage.setItem("theme", nextScheme);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.waitForFunction(
    (nextScheme: ColourScheme) => document.documentElement.classList.contains(nextScheme),
    scheme,
  );
}

async function restoreThemeState(page: Page, state: ThemeState): Promise<void> {
  await page.evaluate((previousState) => {
    const root = document.documentElement;

    if (previousState.hasDarkThemeClass) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (previousState.hasLightThemeClass) {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }

    if (previousState.storedTheme === null) {
      window.localStorage.removeItem("theme");

      return;
    }

    window.localStorage.setItem("theme", previousState.storedTheme);
  }, state);
}

export async function captureVisualSnapshot(
  page: Page,
  name: string,
  options?: VisualSnapshotOptions,
): Promise<void> {
  if (!canCaptureVisualSnapshot()) {
    return;
  }

  await expect(page).toMatchVisualSnapshot(name, {
    fullPage: true,
    ...options,
    ignoreSelectors: [...DYNAMIC_COPY_SELECTORS, ...(options?.ignoreSelectors ?? [])],
  });
}

export async function captureVisualSnapshots(
  page: Page,
  name: string,
  options: VisualCheckpointOptions = {},
): Promise<void> {
  if (!canCaptureVisualSnapshot()) {
    return;
  }

  const {
    fullPage = true,
    viewports = DEFAULT_VIEWPORTS,
    colorSchemes = DEFAULT_SCHEMES,
    snapshotOptions = {},
  } = options;
  const originalTheme = await getThemeState(page);

  const originalViewport = page.viewportSize();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const scheme of colorSchemes) {
      await setThemeAndMediaForScheme(page, scheme);
      await expect(page).toMatchVisualSnapshot(name, {
        ...snapshotOptions,
        fullPage,
        ignoreSelectors: [...DYNAMIC_COPY_SELECTORS, ...(snapshotOptions.ignoreSelectors ?? [])],
        variant: `${viewport.name}-${scheme}`,
      });
    }
  }

  await restoreThemeState(page, originalTheme);
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }

  await page.emulateMedia();
}
