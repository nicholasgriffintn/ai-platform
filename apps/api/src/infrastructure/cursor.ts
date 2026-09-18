const CURSOR_SEPARATOR = "|";

export function encodeCompositeCursor(parts: readonly string[]): string {
  return btoa(parts.join(CURSOR_SEPARATOR));
}

export function decodeCompositeCursor(cursor: string, expectedParts: number): string[] | null {
  try {
    const parts = atob(cursor).split(CURSOR_SEPARATOR);

    return parts.length === expectedParts ? parts : null;
  } catch {
    return null;
  }
}
