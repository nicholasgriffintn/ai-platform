import type { SectionNavItem } from "~/components/Core/SectionNav";

export const MODELS_SECTIONS = {
  tiers: { id: "tiers", label: "Tiers" },
  local: { id: "local", label: "On your own hardware" },
  system: { id: "system", label: "System models" },
  behindTheScenes: { id: "behind-the-scenes", label: "Behind the scenes" },
  catalogue: { id: "catalogue", label: "By provider" },
} as const satisfies Record<string, SectionNavItem>;

export const MODELS_SECTION_NAV: readonly SectionNavItem[] = Object.values(MODELS_SECTIONS);
