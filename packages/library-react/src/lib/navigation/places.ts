import { getStoryPath, STORY_PATH_PREFIX } from "@ngriffin_uk/polychat-schemas";

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

export const DISCOVER_PATH = "/";

export { getStoryPath, STORY_PATH_PREFIX };

export const ENTITY_PATH_PREFIX = "/discover/entities";
export const COVERAGE_TRACKER_PATH = "/discover/tracker";

export function getStoryEntityPath(entityId: string): string {
  return `${ENTITY_PATH_PREFIX}/${encodeURIComponent(entityId)}`;
}

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

const CHAT_PAGE_SEGMENTS = new Set(["attention", "files", "teammates", "plugins", "scheduled"]);
const CHAT_COMPLETION_PATH = /^\/chat\/([^/]+)\/?$/u;

export function matchChatCompletionId(pathname: string): string | undefined {
  const segment = CHAT_COMPLETION_PATH.exec(pathname)?.[1];

  return segment && !CHAT_PAGE_SEGMENTS.has(segment) ? decodeURIComponent(segment) : undefined;
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

  if (
    pathname === DISCOVER_PATH ||
    pathname === COVERAGE_TRACKER_PATH ||
    pathname.startsWith(`${STORY_PATH_PREFIX}/`) ||
    pathname.startsWith(`${ENTITY_PATH_PREFIX}/`)
  ) {
    return "discover";
  }

  const mode = getProductMode(pathname);
  const base = MODE_BASE_PATHS[mode];
  const isModeRoute = pathname === base || pathname.startsWith(`${base}/`);

  if (!isModeRoute) {
    return undefined;
  }

  const rest = pathname.slice(base.length).replace(/^\/+/, "");
  const parts = rest.split("/").filter(Boolean);
  const appsIndex = parts.indexOf("apps");

  if (appsIndex !== -1) {
    return parts[appsIndex + 1] === "sites" ? "sites" : "plugins";
  }

  const segments = new Set(parts);

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
