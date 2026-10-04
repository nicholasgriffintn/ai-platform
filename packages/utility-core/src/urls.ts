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

export function readGoogleDriveFolderId(value: string): string | null {
  const candidate = value.trim();

  if (/^[A-Za-z0-9_-]{1,200}$/.test(candidate)) {
    return candidate;
  }

  try {
    const url = new URL(candidate);

    if (url.origin !== "https://drive.google.com" || url.username || url.password) {
      return null;
    }

    return (
      url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{1,200})\/?$/)?.[1] ?? null
    );
  } catch {
    return null;
  }
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
