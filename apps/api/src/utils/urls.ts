import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";

export { isPrivateHostname };

export function appendUrlPath(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

export function normaliseHttpOrigin(value: string | undefined): string | null {
  const candidate = value?.trim();

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function isUrlWithinOrigin(candidate: string, allowedOrigin: string | undefined): boolean {
  const origin = normaliseHttpOrigin(allowedOrigin);

  if (!origin) {
    return false;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    return url.origin === origin;
  } catch {
    return false;
  }
}

export function appendQueryParams(baseUrl: URL, params: Record<string, unknown> | undefined): void {
  if (!params) {
    return;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== undefined && entry !== null) {
          baseUrl.searchParams.append(key, String(entry));
        }
      }
    } else {
      baseUrl.searchParams.set(key, String(value));
    }
  }
}
