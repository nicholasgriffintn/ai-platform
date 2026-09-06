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

const THEME_STORAGE_KEY = "polychat-theme";

type ThemeState = {
  themeId: string | null;
  storedTheme: string | null;
};

async function getThemeState(page: Page): Promise<ThemeState> {
  return page.evaluate((storageKey) => {
    const root = document.documentElement;

    return {
      themeId: root.dataset.polychatTheme ?? null,
      storedTheme: window.localStorage.getItem(storageKey),
    };
  }, THEME_STORAGE_KEY);
}

async function applyThemeId(page: Page, themeId: string | null): Promise<void> {
  await page.evaluate((nextThemeId) => {
    const root = document.documentElement;

    if (nextThemeId === null) {
      delete root.dataset.polychatTheme;
      root.classList.remove("light", "dark");

      return;
    }

    root.dataset.polychatTheme = nextThemeId;
    root.classList.toggle("dark", nextThemeId !== "light");
    root.classList.toggle("light", nextThemeId === "light");
  }, themeId);
}

async function setThemeAndMediaForScheme(page: Page, scheme: ColourScheme): Promise<void> {
  await page.evaluate(
    ({ nextScheme, storageKey }) => {
      window.localStorage.setItem(storageKey, nextScheme);
    },
    { nextScheme: scheme, storageKey: THEME_STORAGE_KEY },
  );
  await applyThemeId(page, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.waitForFunction(
    (nextScheme: ColourScheme) => document.documentElement.dataset.polychatTheme === nextScheme,
    scheme,
  );
}

async function restoreThemeState(page: Page, state: ThemeState): Promise<void> {
  await applyThemeId(page, state.themeId);
  await page.evaluate(
    ({ previousState, storageKey }) => {
      if (previousState.storedTheme === null) {
        window.localStorage.removeItem(storageKey);

        return;
      }

      window.localStorage.setItem(storageKey, previousState.storedTheme);
    },
    { previousState: state, storageKey: THEME_STORAGE_KEY },
  );
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
