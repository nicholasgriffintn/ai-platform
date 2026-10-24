export type ProductMode = "chat" | "work";

export type ProductPlace =
  | "conversations"
  | "discover"
  | "sites"
  | "attention"
  | "files"
  | "teammates"
  | "plugins"
  | "scheduled"
  | "you";

export const MODE_BASE_PATHS: Record<ProductMode, string> = {
  chat: "/chat",
  work: "/work",
};

export const PROFILE_PATH = "/profile";
export const PET_SETTINGS_PATH = `${PROFILE_PATH}?tab=pets`;

export const DISCOVER_PATH = "/discover";

export const TOUR_PATH = "/tour";

export interface PlacePaths {
  conversations: string;
  discover: string;
  sites: string;
  attention: string;
  files: string;
  teammates: string;
  plugins: string;
  scheduled: string;
}

export function getPlacePaths(mode: ProductMode): PlacePaths {
  const base = MODE_BASE_PATHS[mode];

  return {
    conversations: base,
    discover: DISCOVER_PATH,
    sites: `${base}/apps/sites`,
    attention: `${base}/attention`,
    files: `${base}/files`,
    teammates: `${base}/teammates`,
    plugins: `${base}/plugins`,
    scheduled: `${base}/scheduled`,
  };
}

export function getTeammateGroupPath(conversationId: string): string {
  return `${MODE_BASE_PATHS.chat}/groups/${encodeURIComponent(conversationId)}`;
}

const TEAMMATE_THREAD_PATH =
  /^(?:\/chat\/(?:teammates|groups)|\/work\/[^/]+\/projects\/[^/]+\/teammates)\/[^/]+\/?$/u;

export function isTeammateThreadPath(pathname: string): boolean {
  return TEAMMATE_THREAD_PATH.test(pathname);
}

export function getProductMode(pathname: string): ProductMode {
  return pathname === MODE_BASE_PATHS.work || pathname.startsWith(`${MODE_BASE_PATHS.work}/`)
    ? "work"
    : "chat";
}

const PLACE_SEGMENTS: Array<[Exclude<ProductPlace, "conversations" | "you">, string[]]> = [
  ["sites", ["sites"]],
  ["attention", ["attention"]],
  ["files", ["files"]],
  ["teammates", ["teammates"]],
  ["plugins", ["plugins", "apps", "tools", "skills"]],
  ["scheduled", ["scheduled"]],
];

export function getActivePlace(pathname: string): ProductPlace | undefined {
  if (pathname === PROFILE_PATH || pathname.startsWith(`${PROFILE_PATH}/`)) {
    return "you";
  }

  if (pathname === DISCOVER_PATH) {
    return "discover";
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
