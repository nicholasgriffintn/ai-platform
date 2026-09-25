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
