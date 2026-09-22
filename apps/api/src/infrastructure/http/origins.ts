import {
  DESKTOP_LOCAL_HOST,
  DESKTOP_ORIGINS,
  LOCAL_HOST,
  METRICS_LOCAL_HOST,
  METRICS_PROD_HOST,
  PROD_HOST,
} from "~/config/app";

function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

export function isDesktopOrigin(origin: string): boolean {
  return (DESKTOP_ORIGINS as readonly string[]).includes(origin);
}

export function isAllowedOrigin(origin: string, environment: string, appBaseUrl?: string): boolean {
  if (isDesktopOrigin(origin)) {
    return true;
  }

  const parsedOrigin = parseOrigin(origin);

  if (!parsedOrigin) {
    return false;
  }

  const configuredAppOrigin = appBaseUrl ? parseOrigin(appBaseUrl) : null;
  const host = parsedOrigin.host;

  if (environment === "production") {
    return host === PROD_HOST || host === METRICS_PROD_HOST;
  }

  if (environment === "preview") {
    return parsedOrigin.origin === configuredAppOrigin?.origin;
  }

  if (environment === "development") {
    return (
      host === LOCAL_HOST ||
      host === DESKTOP_LOCAL_HOST ||
      host === configuredAppOrigin?.host ||
      host === METRICS_LOCAL_HOST
    );
  }

  return false;
}
