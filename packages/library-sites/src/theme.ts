import type {
  SiteFont,
  SiteMode,
  SitePalette,
  SiteRadius,
  SiteTheme,
} from "@ngriffin_uk/polychat-schemas";

interface PaletteDefinition {
  label: string;
  hue: number;
  chroma: number;
  neutralHue: number;
  neutralChroma: number;
}

export const SITE_PALETTE_DEFINITIONS: Record<SitePalette, PaletteDefinition> = {
  neutral: { label: "Neutral", hue: 260, chroma: 0.02, neutralHue: 260, neutralChroma: 0.005 },
  slate: { label: "Slate", hue: 250, chroma: 0.12, neutralHue: 250, neutralChroma: 0.012 },
  ocean: { label: "Ocean", hue: 230, chroma: 0.16, neutralHue: 235, neutralChroma: 0.01 },
  forest: { label: "Forest", hue: 155, chroma: 0.13, neutralHue: 150, neutralChroma: 0.01 },
  sunset: { label: "Sunset", hue: 40, chroma: 0.17, neutralHue: 45, neutralChroma: 0.012 },
  berry: { label: "Berry", hue: 340, chroma: 0.17, neutralHue: 335, neutralChroma: 0.01 },
  sand: { label: "Sand", hue: 75, chroma: 0.08, neutralHue: 80, neutralChroma: 0.015 },
  midnight: { label: "Midnight", hue: 280, chroma: 0.15, neutralHue: 275, neutralChroma: 0.02 },
};

export const SITE_FONT_STACKS: Record<
  SiteFont,
  { body: string; heading: string; google: string[] }
> = {
  sans: {
    body: '"Inter", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    heading: '"Inter", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    google: ["Inter:wght@400;500;600;700"],
  },
  serif: {
    body: '"Source Serif 4", "Fraunces", ui-serif, Georgia, serif',
    heading: '"Source Serif 4", "Fraunces", ui-serif, Georgia, serif',
    google: ["Source+Serif+4:wght@400;600;700"],
  },
  mono: {
    body: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    heading: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    google: ["IBM+Plex+Mono:wght@400;500;600"],
  },
  display: {
    body: '"Inter", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
    heading: '"Fraunces", ui-serif, Georgia, serif',
    google: ["Inter:wght@400;500;600", "Fraunces:opsz,wght@9..144,500;9..144,700"],
  },
};

export const SITE_RADIUS_VALUES: Record<SiteRadius, string> = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.625rem",
  lg: "1rem",
  full: "1.5rem",
};

function oklch(l: number, c: number, h: number): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;
}

export type SiteThemeVariables = Record<string, string>;

export function buildSiteColorVariables(palette: SitePalette, mode: SiteMode): SiteThemeVariables {
  const definition = SITE_PALETTE_DEFINITIONS[palette];
  const { hue, chroma, neutralHue, neutralChroma } = definition;
  const primaryLightness = mode === "light" ? 0.5 : 0.72;
  const primaryForeground = mode === "light" ? oklch(0.985, 0.005, hue) : oklch(0.16, 0.02, hue);

  if (mode === "light") {
    return {
      "--background": oklch(0.99, neutralChroma * 0.6, neutralHue),
      "--foreground": oklch(0.17, neutralChroma * 2, neutralHue),
      "--card": oklch(1, 0, neutralHue),
      "--card-foreground": oklch(0.17, neutralChroma * 2, neutralHue),
      "--popover": oklch(1, 0, neutralHue),
      "--popover-foreground": oklch(0.17, neutralChroma * 2, neutralHue),
      "--primary": oklch(primaryLightness, chroma, hue),
      "--primary-foreground": primaryForeground,
      "--secondary": oklch(0.955, neutralChroma * 1.2, neutralHue),
      "--secondary-foreground": oklch(0.25, neutralChroma * 2, neutralHue),
      "--muted": oklch(0.96, neutralChroma, neutralHue),
      "--muted-foreground": oklch(0.5, neutralChroma * 2, neutralHue),
      "--accent": oklch(0.95, Math.min(chroma * 0.35, 0.05), hue),
      "--accent-foreground": oklch(0.25, chroma * 0.6, hue),
      "--destructive": oklch(0.55, 0.19, 25),
      "--border": oklch(0.91, neutralChroma * 1.5, neutralHue),
      "--input": oklch(0.91, neutralChroma * 1.5, neutralHue),
      "--ring": oklch(primaryLightness, chroma, hue),
      "--chart-1": oklch(0.6, chroma, hue),
      "--chart-2": oklch(0.65, chroma * 0.9, (hue + 40) % 360),
      "--chart-3": oklch(0.7, chroma * 0.8, (hue + 80) % 360),
      "--chart-4": oklch(0.55, chroma * 0.9, (hue + 200) % 360),
      "--chart-5": oklch(0.75, chroma * 0.7, (hue + 300) % 360),
    };
  }

  return {
    "--background": oklch(0.16, neutralChroma * 1.5, neutralHue),
    "--foreground": oklch(0.96, neutralChroma, neutralHue),
    "--card": oklch(0.2, neutralChroma * 1.5, neutralHue),
    "--card-foreground": oklch(0.96, neutralChroma, neutralHue),
    "--popover": oklch(0.2, neutralChroma * 1.5, neutralHue),
    "--popover-foreground": oklch(0.96, neutralChroma, neutralHue),
    "--primary": oklch(primaryLightness, chroma, hue),
    "--primary-foreground": primaryForeground,
    "--secondary": oklch(0.27, neutralChroma * 1.5, neutralHue),
    "--secondary-foreground": oklch(0.95, neutralChroma, neutralHue),
    "--muted": oklch(0.25, neutralChroma * 1.5, neutralHue),
    "--muted-foreground": oklch(0.7, neutralChroma * 1.5, neutralHue),
    "--accent": oklch(0.28, Math.min(chroma * 0.4, 0.06), hue),
    "--accent-foreground": oklch(0.95, chroma * 0.3, hue),
    "--destructive": oklch(0.65, 0.18, 25),
    "--border": oklch(0.3, neutralChroma * 1.5, neutralHue),
    "--input": oklch(0.32, neutralChroma * 1.5, neutralHue),
    "--ring": oklch(primaryLightness, chroma, hue),
    "--chart-1": oklch(0.7, chroma, hue),
    "--chart-2": oklch(0.72, chroma * 0.9, (hue + 40) % 360),
    "--chart-3": oklch(0.75, chroma * 0.8, (hue + 80) % 360),
    "--chart-4": oklch(0.65, chroma * 0.9, (hue + 200) % 360),
    "--chart-5": oklch(0.8, chroma * 0.7, (hue + 300) % 360),
  };
}

export function buildSiteThemeVariables(theme: SiteTheme): SiteThemeVariables {
  const fonts = SITE_FONT_STACKS[theme.font];

  return {
    ...buildSiteColorVariables(theme.palette, theme.mode),
    "--radius": SITE_RADIUS_VALUES[theme.radius],
    "--font-sans": fonts.body,
    "--font-heading": fonts.heading,
    "color-scheme": theme.mode,
  };
}

export function renderSiteThemeCss(theme: SiteTheme): string {
  const light = buildSiteColorVariables(theme.palette, "light");
  const dark = buildSiteColorVariables(theme.palette, "dark");
  const fonts = SITE_FONT_STACKS[theme.font];
  const block = (variables: SiteThemeVariables) =>
    Object.entries(variables)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n");

  return [
    ":root {",
    block(light),
    `  --radius: ${SITE_RADIUS_VALUES[theme.radius]};`,
    `  --font-sans: ${fonts.body};`,
    `  --font-heading: ${fonts.heading};`,
    "}",
    "",
    ".dark {",
    block(dark),
    "}",
  ].join("\n");
}

export function buildSiteGoogleFontsUrl(font: SiteFont): string {
  const families = SITE_FONT_STACKS[font].google.map((family) => `family=${family}`).join("&");

  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
