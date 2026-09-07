export type ProductMode = "chat" | "work";

export type ProductPlace = "conversations" | "attention" | "files" | "teammates" | "you";

export const MODE_BASE_PATHS: Record<ProductMode, string> = {
  chat: "/chat",
  work: "/work",
};

export const PROFILE_PATH = "/profile";

export const DISCOVER_PATH = "/discover";

export interface PlacePaths {
  conversations: string;
  attention: string;
  files: string;
  teammates: string;
}

export function getPlacePaths(mode: ProductMode): PlacePaths {
  const base = MODE_BASE_PATHS[mode];

  return {
    conversations: base,
    attention: `${base}/attention`,
    files: `${base}/files`,
    teammates: `${base}/teammates`,
  };
}

export function getProductMode(pathname: string): ProductMode {
  return pathname === MODE_BASE_PATHS.work || pathname.startsWith(`${MODE_BASE_PATHS.work}/`)
    ? "work"
    : "chat";
}

const PLACE_SEGMENTS: Array<[Exclude<ProductPlace, "conversations" | "you">, string[]]> = [
  ["attention", ["attention"]],
  ["files", ["files"]],
  ["teammates", ["teammates", "apps", "tools"]],
];

export function getActivePlace(pathname: string): ProductPlace | undefined {
  if (pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`)) {
    return "you";
  }

  const mode = getProductMode(pathname);
  const base = MODE_BASE_PATHS[mode];
  const isModeRoute = pathname === "/" || pathname === base || pathname.startsWith(`${base}/`);

  if (!isModeRoute) {
    return undefined;
  }

  const rest = pathname.slice(base.length).replace(/^\/+/, "");
  const segments = new Set(rest.split("/").filter(Boolean));

  for (const [place, placeSegments] of PLACE_SEGMENTS) {
    if (placeSegments.some((segment) => segments.has(segment))) {
      return place;
    }
  }

  return "conversations";
}

export function isProductModeRoute(pathname: string): boolean {
  const place = getActivePlace(pathname);

  return place !== undefined && place !== "you";
}
