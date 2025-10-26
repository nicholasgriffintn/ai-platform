export const VIDEO_FILE_EXTENSIONS = [".mp4", ".mov", ".webm", ".mkv", ".avi"];

function isLikelyVideoUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    /^https?:\/\//.test(url) &&
    VIDEO_FILE_EXTENSIONS.some((ext) => normalized.includes(ext))
  );
}

export function findDirectVideoUrl(payload: any): string | undefined {
  if (!payload) {
    return undefined;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (isLikelyVideoUrl(trimmed)) {
      return trimmed;
    }
    return undefined;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const result = findDirectVideoUrl(item);
      if (result) {
        return result;
      }
    }
    return undefined;
  }

  if (typeof payload === "object") {
    for (const value of Object.values(payload)) {
      const result = findDirectVideoUrl(value);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}
