const PROJECT_COLOUR_PALETTE = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#84CC16",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
] as const;

function normaliseProjectIdentityPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function deriveProjectColour(name: string, description: string): string {
  const identity = `${normaliseProjectIdentityPart(name)}\0${normaliseProjectIdentityPart(description)}`;
  let hash = 0x811c9dc5;

  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return PROJECT_COLOUR_PALETTE[(hash >>> 0) % PROJECT_COLOUR_PALETTE.length];
}
