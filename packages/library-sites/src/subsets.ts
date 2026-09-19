import type { SiteKind, SiteProject } from "@ngriffin_uk/polychat-schemas";

import { SITE_COMPONENT_TYPES, type SiteComponentType } from "./catalog.js";

const LAYOUT: readonly SiteComponentType[] = [
  "Page",
  "Section",
  "Stack",
  "Grid",
  "Card",
  "Divider",
  "Spacer",
];
const CONTENT: readonly SiteComponentType[] = [
  "Heading",
  "Text",
  "Badge",
  "Button",
  "Link",
  "Image",
  "Icon",
  "Avatar",
  "List",
  "Quote",
  "Alert",
];
const MARKETING_SECTIONS: readonly SiteComponentType[] = [
  "Navbar",
  "Footer",
  "Hero",
  "FeatureGrid",
  "Stats",
  "LogoCloud",
  "Testimonials",
  "Pricing",
  "FAQ",
  "CTA",
  "Steps",
  "Team",
  "Gallery",
  "Newsletter",
  "Articles",
  "Form",
  "Tabs",
];
const APPLICATION: readonly SiteComponentType[] = [
  "AppShell",
  "Tabs",
  "Breadcrumbs",
  "Metric",
  "Progress",
  "Chart",
  "Table",
  "KeyValue",
  "EmptyState",
  "Form",
  "Input",
  "Select",
  "Switch",
  "Code",
];

const KIND_COMPONENTS: Record<SiteKind, readonly SiteComponentType[]> = {
  landing: [...LAYOUT, ...CONTENT, ...MARKETING_SECTIONS],
  marketing: [...LAYOUT, ...CONTENT, ...MARKETING_SECTIONS],
  portfolio: [...LAYOUT, ...CONTENT, ...MARKETING_SECTIONS],
  dashboard: [...LAYOUT, ...CONTENT, ...APPLICATION],
  app: [...LAYOUT, ...CONTENT, ...APPLICATION, "Navbar", "Footer", "CTA"],
  form: [...LAYOUT, ...CONTENT, "Navbar", "Footer", "Form", "Steps", "Input", "Select", "Switch"],
  docs: [
    ...LAYOUT,
    ...CONTENT,
    "Navbar",
    "Footer",
    "Breadcrumbs",
    "Tabs",
    "Code",
    "Table",
    "KeyValue",
    "CTA",
  ],
  component: SITE_COMPONENT_TYPES,
  commerce: [...LAYOUT, ...CONTENT, ...APPLICATION, ...MARKETING_SECTIONS],
  booking: [...LAYOUT, ...CONTENT, ...APPLICATION, "Navbar", "Footer", "Steps", "CTA"],
  event: [...LAYOUT, ...CONTENT, ...APPLICATION, ...MARKETING_SECTIONS],
  publication: [...LAYOUT, ...CONTENT, ...MARKETING_SECTIONS, "Breadcrumbs", "Code"],
  community: [...LAYOUT, ...CONTENT, ...APPLICATION, "Navbar", "Footer"],
  education: [...LAYOUT, ...CONTENT, ...APPLICATION, "Navbar", "Footer", "Steps", "Articles"],
  "ai-tool": [...LAYOUT, ...CONTENT, ...APPLICATION, "Navbar", "Footer"],
  game: SITE_COMPONENT_TYPES,
};

export function componentsForSiteKind(kind: SiteKind): SiteComponentType[] {
  return SITE_COMPONENT_TYPES.filter((type) => KIND_COMPONENTS[kind].includes(type));
}

export function componentsUsedInSite(project: SiteProject): SiteComponentType[] {
  const used = new Set<string>();

  for (const page of Object.values(project.pages)) {
    for (const element of Object.values(page.elements)) {
      used.add(element.type);
    }
  }

  return SITE_COMPONENT_TYPES.filter((type) => used.has(type));
}

export function componentsForSiteRefinement(
  project: SiteProject,
  kind: SiteKind,
): SiteComponentType[] {
  const allowed = new Set<SiteComponentType>([
    ...componentsForSiteKind(kind),
    ...componentsUsedInSite(project),
  ]);

  return SITE_COMPONENT_TYPES.filter((type) => allowed.has(type));
}

export function catalogueSubsetId(components: readonly SiteComponentType[]): string {
  if (components.length === SITE_COMPONENT_TYPES.length) {
    return "all";
  }

  const bits = SITE_COMPONENT_TYPES.map((type) => (components.includes(type) ? "1" : "0")).join("");

  return Number.parseInt(bits, 2).toString(36);
}
