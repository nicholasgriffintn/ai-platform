import type { SiteElementStyle, SiteTheme } from "@ngriffin_uk/polychat-schemas";

import { renderSiteElementPaletteCss } from "./theme.js";

const WIDTH = {
  narrow: "mx-auto w-full max-w-3xl",
  content: "mx-auto w-full max-w-6xl",
  wide: "mx-auto w-full max-w-7xl",
  full: "w-full max-w-none",
} as const;

const SPACING = {
  none: "p-0",
  compact: "p-3 sm:p-4",
  normal: "p-5 sm:p-6",
  generous: "p-8 sm:p-12",
  dramatic: "p-10 sm:p-16 lg:p-24",
} as const;

const PALETTE = {
  neutral: "site-palette-neutral",
  slate: "site-palette-slate",
  ocean: "site-palette-ocean",
  forest: "site-palette-forest",
  sunset: "site-palette-sunset",
  berry: "site-palette-berry",
  sand: "site-palette-sand",
  midnight: "site-palette-midnight",
} as const;

const TONE = {
  inherit: "",
  muted: "text-muted-foreground",
  primary: "text-primary",
} as const;

const SURFACE = {
  transparent: "bg-transparent",
  canvas: "site-surface-override bg-background text-foreground",
  muted: "site-surface-override bg-muted/60 text-foreground",
  card: "site-surface-override bg-card text-card-foreground",
  primary: "site-surface-override site-surface-contrast bg-primary text-primary-foreground",
  inverted: "site-surface-override site-surface-contrast bg-foreground text-background",
  glass: "site-surface-override bg-background/70 text-foreground backdrop-blur-xl",
} as const;

const ALIGN = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

const BORDER = {
  none: "border-0",
  subtle: "border border-border/70",
  strong: "border-2 border-foreground",
} as const;

const SHADOW = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-lg",
  xl: "shadow-2xl",
} as const;

const RADIUS = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-2xl",
  full: "rounded-[2rem]",
} as const;

const MOTION = {
  none: "",
  fade: "site-motion-fade",
  rise: "site-motion-rise",
  scale: "site-motion-scale",
  slide: "site-motion-slide",
} as const;

export function siteElementStyleClasses(style: SiteElementStyle | undefined): string {
  if (!style) {
    return "";
  }

  return [
    style.width && WIDTH[style.width],
    style.spacing && SPACING[style.spacing],
    style.palette && PALETTE[style.palette],
    style.tone && TONE[style.tone],
    style.surface && SURFACE[style.surface],
    style.align && ALIGN[style.align],
    style.border && BORDER[style.border],
    style.shadow && SHADOW[style.shadow],
    style.radius && RADIUS[style.radius],
    style.motion && MOTION[style.motion],
    style.bleed && "site-bleed",
    style.sticky && "sticky top-0 z-20",
  ]
    .filter(Boolean)
    .join(" ");
}

export function siteThemeClasses(theme: SiteTheme): string {
  return [
    `site-direction-${theme.direction}`,
    `site-density-${theme.density}`,
    `site-texture-${theme.texture}`,
    `site-motion-${theme.motion}`,
  ].join(" ");
}

export const SITE_EXPRESSION_CSS = `
${renderSiteElementPaletteCss()}

@keyframes site-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes site-rise { from { opacity: 0; transform: translateY(1.25rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes site-scale { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
@keyframes site-slide { from { opacity: 0; transform: translateX(-1.5rem); } to { opacity: 1; transform: translateX(0); } }

.site-motion-fade { animation: site-fade .5s ease-out both; }
.site-motion-rise { animation: site-rise .6s cubic-bezier(.2,.8,.2,1) both; }
.site-motion-scale { animation: site-scale .5s cubic-bezier(.2,.8,.2,1) both; }
.site-motion-slide { animation: site-slide .6s cubic-bezier(.2,.8,.2,1) both; }
.site-motion-none [class*="site-motion-"] { animation: none; }
.site-motion-restrained [class*="site-motion-"] { animation-duration: .35s; }
.site-motion-expressive [class*="site-motion-"] { animation-duration: .8s; }
.site-surface-override > :first-child,
.site-surface-override > [data-site-key] > :first-child {
  background: transparent !important;
  color: inherit;
}
.site-bleed { width: 100vw; margin-left: calc(50% - 50vw); }
.site-density-compact { --site-section-space: 3rem; --site-control-height: 2.25rem; }
.site-density-comfortable { --site-section-space: 5rem; --site-control-height: 2.5rem; }
.site-density-spacious { --site-section-space: 8rem; --site-control-height: 3rem; }
.site-direction-brutalist { --radius: 0rem; }
.site-direction-luxury { letter-spacing: .005em; }
.site-direction-utilitarian { font-variant-numeric: tabular-nums; }
.site-texture-grid { background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 32px 32px; }
.site-texture-gradient { background-image: radial-gradient(circle at 10% 0%, var(--accent), transparent 38%), radial-gradient(circle at 90% 15%, var(--secondary), transparent 42%); }
.site-texture-glow { background-image: radial-gradient(circle at 50% -10%, var(--primary), transparent 34%); }
.site-texture-grain { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.055'/%3E%3C/svg%3E"); }

@media (prefers-reduced-motion: reduce) {
  [class*="site-motion-"] { animation: none !important; scroll-behavior: auto !important; }
}
`;
