export const DISCOVER_PATH = "/discover";

export interface DiscoverSection {
  id: string;
  label: string;
}

export const DISCOVER_SECTIONS: readonly DiscoverSection[] = [
  { id: "chat-and-work", label: "Chat and Work" },
  { id: "models", label: "Models" },
  { id: "capabilities", label: "Capabilities" },
  { id: "pets", label: "Pets" },
  { id: "pricing", label: "Pricing" },
  { id: "keys", label: "Your keys" },
];

export function discoverSectionHref(id: string): string {
  return `${DISCOVER_PATH}#${id}`;
}
