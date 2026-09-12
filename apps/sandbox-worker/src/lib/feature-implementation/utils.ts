export function normaliseRepoRelativePath(rawPath: string): string {
  const trimmed = rawPath.trim().replace(/^['"`]|['"`]$/g, "");
  const unixPath = trimmed.replace(/\\+/g, "/");

  if (!unixPath) {
    throw new Error("File path is required");
  }

  if (unixPath.startsWith("/")) {
    throw new Error("File path must be relative to the repository root");
  }

  if (
    unixPath.includes("\r") ||
    unixPath.includes("\n") ||
    unixPath.includes(String.fromCharCode(0))
  ) {
    throw new Error("File path contains invalid control characters");
  }

  const segments = unixPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw new Error("File path is invalid");
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("File path cannot contain relative traversal segments");
  }

  const normalised = segments.join("/");

  if (normalised.length > 260) {
    throw new Error("File path is too long");
  }

  return normalised;
}

export function parsePositiveInteger(value: unknown, fallback: number, maxValue: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.trunc(value);

  if (rounded <= 0) {
    return fallback;
  }

  return Math.min(rounded, maxValue);
}

export function extractRelativePath(repoTargetDir: string, absolutePath: string): string {
  const normalisedPrefix = `${repoTargetDir.replace(/\/+$/, "")}/`;

  if (absolutePath.startsWith(normalisedPrefix)) {
    return absolutePath.slice(normalisedPrefix.length);
  }

  return absolutePath;
}

export function parsePriority(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

export function toPrioritySortValue(priority?: number): number {
  if (typeof priority === "number" && Number.isFinite(priority)) {
    return priority;
  }

  return Number.MAX_SAFE_INTEGER;
}

export function formatStoryLabel(story: { id?: string; title: string }): string {
  return story.id ? `${story.id} ${story.title}` : story.title;
}
