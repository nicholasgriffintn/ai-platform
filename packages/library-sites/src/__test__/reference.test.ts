import { DEFAULT_SITE_THEME } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { resolveSitePlan } from "../plan";
import { readSiteReferenceFontFamily, resolveSiteReferencePalette } from "../reference";
import { buildSiteGoogleFontsUrl, renderSiteThemeCss } from "../theme";

const capture = {
  status: "captured" as const,
  background: "#ffffff",
  foreground: "#0a2540",
  accents: [
    { colour: "#f6f9fc", weight: 900 },
    { colour: "#635bff", weight: 400 },
    { colour: "#e4572e", weight: 20 },
  ],
  headingFamily: null,
  bodyFamily: null,
};

describe("resolveSiteReferencePalette", () => {
  it("takes the heaviest saturated accent as the primary hue and keeps a light mode", () => {
    const { customPalette, palette, mode } = resolveSiteReferencePalette(capture);

    expect(customPalette.hue).toBeGreaterThan(270);
    expect(customPalette.hue).toBeLessThan(290);
    expect(customPalette.chroma).toBeGreaterThanOrEqual(0.2);
    expect(palette).toBe("midnight");
    expect(mode).toBe("light");
  });

  it("switches to dark mode on a dark background and stays neutral without an accent", () => {
    const resolved = resolveSiteReferencePalette({
      ...capture,
      background: "#111111",
      foreground: "#eeeeee",
      accents: [{ colour: "#333333", weight: 500 }],
    });

    expect(resolved.mode).toBe("dark");
    expect(resolved.palette).toBe("neutral");
    expect(resolved.customPalette.chroma).toBeLessThan(0.04);
  });
});

describe("readSiteReferenceFontFamily", () => {
  it("reads the first named family and unwraps hashed framework fonts", () => {
    expect(readSiteReferenceFontFamily('"Source Serif 4", Georgia, serif')).toBe("Source Serif 4");
    expect(readSiteReferenceFontFamily("__Inter_d65c78, __Inter_Fallback_d65c78")).toBe("Inter");
  });

  it("skips generic and unsafe family names", () => {
    expect(readSiteReferenceFontFamily("-apple-system, system-ui, sans-serif")).toBeNull();
    expect(readSiteReferenceFontFamily('"Evil\\"; } body { x", serif')).toBeNull();
  });
});

describe("reference theme rendering", () => {
  const theme = {
    ...DEFAULT_SITE_THEME,
    font: "serif" as const,
    customPalette: { hue: 280, chroma: 0.2, neutralHue: 250, neutralChroma: 0.01 },
    customFonts: { heading: "Playfair Display", body: "Inter" },
  };

  it("keeps the custom tokens through planning and renders them over the presets", () => {
    const plan = resolveSitePlan({ prompt: "A landing page for a bakery", themeHint: theme });
    const css = renderSiteThemeCss(plan.theme);

    expect(css).toContain("--primary: oklch(0.500 0.200 280);");
    expect(css).toContain('--font-heading: "Playfair Display", "Source Serif 4"');
    expect(css).toContain('--font-sans: "Inter", "Source Serif 4"');
  });

  it("requests each custom family once alongside the preset stack", () => {
    expect(
      buildSiteGoogleFontsUrl({ ...theme, customFonts: { heading: "Inter", body: "Inter" } }),
    ).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Source+Serif+4:wght@400;600;700&display=swap",
    );
  });
});
