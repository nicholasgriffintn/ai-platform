import { slugify } from "@ngriffin_uk/polychat-utility-core";

export function normaliseAssistantCapabilityTags(tags: readonly (string | undefined)[]): string[] {
  const normalisedTags = new Set<string>();

  for (const tag of tags) {
    const normalised = tag ? slugify(tag) : undefined;

    if (normalised) {
      normalisedTags.add(normalised);
    }
  }

  return [...normalisedTags];
}
