export function normaliseSameOriginRoute(route: string, origin: string): string | null {
  try {
    const parsed = new URL(route.trim() || "/", origin);

    if (parsed.origin !== origin) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function readUrlPath(value: string): string {
  const queryIndex = value.indexOf("?");
  const fragmentIndex = value.indexOf("#");

  if (queryIndex === -1 && fragmentIndex === -1) {
    return value;
  }

  if (queryIndex === -1) {
    return value.slice(0, fragmentIndex);
  }

  if (fragmentIndex === -1) {
    return value.slice(0, queryIndex);
  }

  return value.slice(0, Math.min(queryIndex, fragmentIndex));
}

export function readUrlExtension(value: string): string | undefined {
  const path = readUrlPath(value);
  const dotIndex = path.lastIndexOf(".");

  if (dotIndex === -1 || dotIndex === path.length - 1) {
    return undefined;
  }

  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  if (dotIndex < separatorIndex) {
    return undefined;
  }

  return path.slice(dotIndex + 1).toLowerCase();
}

export function hasUrlExtension(value: string, extensions: ReadonlySet<string>): boolean {
  const extension = readUrlExtension(value);

  return extension !== undefined && extensions.has(extension);
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//iu.test(value);
}

export function resolveHttpUrl(value: unknown, base?: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value, typeof base === "string" ? base : undefined);

    return isHttpUrl(url.href) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function readUrlHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./u, "");
  } catch {
    return value;
  }
}

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ocid",
  "cmpid",
  "ref_src",
]);
const MIRROR_HOST_PREFIX = /^(?:www|m|mobile|amp)\./u;

function isTrackingParameter(name: string): boolean {
  const key = name.toLowerCase();

  return key.startsWith("utm_") || TRACKING_PARAMETERS.has(key);
}

export function comparableHttpUrl(value: string): string | null {
  const resolved = resolveHttpUrl(value);

  if (!resolved) {
    return null;
  }

  const url = new URL(resolved);
  const path = url.pathname.replace(/\/+$/u, "");

  const kept = new URLSearchParams(
    Array.from(url.searchParams).filter(([name]) => !isTrackingParameter(name)),
  );

  kept.sort();

  const search = kept.toString();

  return `${url.hostname.replace(MIRROR_HOST_PREFIX, "")}${path}${search ? `?${search}` : ""}`;
}

export function isCookieSameSite(pageUrl: string | undefined, apiUrl: string): boolean {
  if (!pageUrl) {
    return false;
  }

  try {
    const page = new URL(pageUrl);
    const api = new URL(apiUrl);

    if (page.protocol !== api.protocol) {
      return false;
    }

    return (
      page.hostname === api.hostname ||
      api.hostname.endsWith(`.${page.hostname}`) ||
      page.hostname.endsWith(`.${api.hostname}`)
    );
  } catch {
    return false;
  }
}

export function readAttachmentFilename(contentDisposition: string | null): string | null {
  const marker = 'filename="';
  const start = contentDisposition?.indexOf(marker) ?? -1;

  if (!contentDisposition || start === -1) {
    return null;
  }

  const end = contentDisposition.indexOf('"', start + marker.length);
  const filename = contentDisposition.slice(start + marker.length, end === -1 ? undefined : end);

  return filename.trim() || null;
}

export function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }

  const text = search.toString();

  return text ? `?${text}` : "";
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;

export function readYouTubeVideoId(value: string): string | null {
  if (!URL.canParse(value)) {
    return null;
  }

  const url = new URL(value);
  const host = url.hostname.replace(/^(www|m)\./, "");
  const candidate =
    host === "youtu.be"
      ? url.pathname.slice(1).split("/")[0]
      : host === "youtube.com" && url.pathname === "/watch"
        ? url.searchParams.get("v")
        : host === "youtube.com" && /^\/(shorts|embed|live)\//.test(url.pathname)
          ? url.pathname.split("/")[2]
          : null;

  return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"'()[\]{}]+/g;
const TRAILING_URL_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "*", "_", "`"]);

export function extractHttpUrls(text: string): string[] {
  const urls = new Set<string>();

  for (const match of text.matchAll(HTTP_URL_PATTERN)) {
    let candidate = match[0];

    while (candidate && TRAILING_URL_PUNCTUATION.has(candidate.at(-1) ?? "")) {
      candidate = candidate.slice(0, -1);
    }

    const resolved = resolveHttpUrl(candidate);

    if (resolved) {
      urls.add(resolved);
    }
  }

  return [...urls];
}
