import { AssistantError, ErrorType } from "~/utils/errors";

const MOBILE_AUTH_SCHEME = "polychat:";
const MOBILE_AUTH_HOST = "auth";
const DESKTOP_LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);

export type NativeAuthPath = "/callback" | "/magic-link";
export type NativePlatform = "mobile" | "desktop";

function hasNoExtras(url: URL): boolean {
  return url.username === "" && url.password === "" && url.search === "" && url.hash === "";
}

function isAllowedMobileRedirect(url: URL, path: NativeAuthPath): boolean {
  return (
    url.protocol === MOBILE_AUTH_SCHEME &&
    url.hostname === MOBILE_AUTH_HOST &&
    url.pathname === path &&
    url.port === "" &&
    hasNoExtras(url)
  );
}

function isAllowedDesktopRedirect(url: URL, path: NativeAuthPath): boolean {
  const port = Number(url.port);

  return (
    url.protocol === "http:" &&
    DESKTOP_LOOPBACK_HOSTS.has(url.hostname) &&
    url.pathname === path &&
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65_535 &&
    hasNoExtras(url)
  );
}

export function isAllowedNativeRedirectUri(
  redirectUri: string | undefined,
  path: NativeAuthPath,
  platform: NativePlatform,
): redirectUri is string {
  if (!redirectUri) {
    return false;
  }

  try {
    const url = new URL(redirectUri);

    return platform === "desktop"
      ? isAllowedDesktopRedirect(url, path)
      : isAllowedMobileRedirect(url, path);
  } catch {
    return false;
  }
}

export function requireNativeRedirectUri(
  redirectUri: string | undefined,
  path: NativeAuthPath,
  platform: NativePlatform,
): string {
  if (!isAllowedNativeRedirectUri(redirectUri, path, platform)) {
    throw new AssistantError(`Invalid ${platform} redirect URI`, ErrorType.PARAMS_ERROR, 400);
  }

  return redirectUri;
}

export function requireAnyNativeRedirectUri(
  redirectUri: string | undefined,
  path: NativeAuthPath,
): string {
  if (isAllowedNativeRedirectUri(redirectUri, path, "mobile")) {
    return redirectUri;
  }

  return requireNativeRedirectUri(redirectUri, path, "desktop");
}

export function buildNativeRedirectUri(
  redirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
