import {
  siteFontFamilySchema,
  type SiteCustomPalette,
  type SiteReferenceCaptureResult,
  type SiteTheme,
} from "@ngriffin_uk/polychat-schemas";
import { hexToOklch, type OklchColor } from "@ngriffin_uk/polychat-utility-core";

import { nearestSitePalette } from "./theme.js";

type SiteReferenceCapture = Extract<SiteReferenceCaptureResult, { status: "captured" }>;

const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "math",
  "emoji",
  "fangsong",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "-apple-system",
  "blinkmacsystemfont",
  "inherit",
  "initial",
]);
const HASHED_FONT_FAMILY = /^__(.+?)_[0-9a-f]{4,}$/i;
const ACCENT_MIN_CHROMA = 0.04;
const ACCENT_MAX_CHROMA = 0.25;
const NEUTRAL_MAX_CHROMA = 0.03;
const DARK_BACKGROUND_LIGHTNESS = 0.5;

function round(value: number, places: number): number {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readSiteReferenceFontFamily(value: string | null): string | null {
  for (const raw of value?.split(",") ?? []) {
    const unquoted = raw.trim().replace(/^["']|["']$/g, "");
    const name = (HASHED_FONT_FAMILY.exec(unquoted)?.[1] ?? unquoted).replaceAll("_", " ").trim();
    const parsed = siteFontFamilySchema.safeParse(name);

    if (
      parsed.success &&
      !GENERIC_FONT_FAMILIES.has(name.toLowerCase()) &&
      !/fallback/i.test(name)
    ) {
      return parsed.data;
    }
  }

  return null;
}

function pickAccent(capture: SiteReferenceCapture): OklchColor | null {
  return (
    [...capture.accents]
      .sort((left, right) => right.weight - left.weight)
      .map(({ colour }) => hexToOklch(colour))
      .find(
        (colour): colour is OklchColor =>
          colour !== null &&
          colour.chroma >= ACCENT_MIN_CHROMA &&
          colour.lightness > 0.25 &&
          colour.lightness < 0.92,
      ) ?? null
  );
}

export function resolveSiteReferencePalette(
  capture: SiteReferenceCapture,
): Pick<SiteTheme, "palette" | "mode"> & { customPalette: SiteCustomPalette } {
  const background = hexToOklch(capture.background ?? "#ffffff") ?? {
    lightness: 1,
    chroma: 0,
    hue: 0,
  };
  const foreground = capture.foreground ? hexToOklch(capture.foreground) : null;
  const accent = pickAccent(capture);
  const neutralHue = background.chroma >= 0.005 ? background.hue : (accent?.hue ?? 0);
  const customPalette: SiteCustomPalette = {
    hue: round(accent?.hue ?? neutralHue, 0) % 360,
    chroma: round(
      accent
        ? clamp(accent.chroma, ACCENT_MIN_CHROMA, ACCENT_MAX_CHROMA)
        : Math.min(background.chroma, 0.02),
      3,
    ),
    neutralHue: round(neutralHue, 0) % 360,
    neutralChroma: round(
      Math.min(Math.max(background.chroma, foreground?.chroma ?? 0), NEUTRAL_MAX_CHROMA),
      3,
    ),
  };

  return {
    customPalette,
    palette: nearestSitePalette(customPalette),
    mode: background.lightness < DARK_BACKGROUND_LIGHTNESS ? "dark" : "light",
  };
}
