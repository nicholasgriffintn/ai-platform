import {
  DESKTOP_LOCAL_HOST,
  DESKTOP_ORIGINS,
  LOCAL_HOST,
  METRICS_LOCAL_HOST,
  METRICS_PROD_HOST,
  PROD_HOST,
} from "~/constants/app";

function getOriginHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

export function isDesktopOrigin(origin: string): boolean {
  return (DESKTOP_ORIGINS as readonly string[]).includes(origin);
}

export function isAllowedOrigin(origin: string, environment: string, appBaseUrl?: string): boolean {
  if (isDesktopOrigin(origin)) {
    return true;
  }

  const host = getOriginHost(origin);

  if (!host) {
    return false;
  }

  if (environment === "production") {
    return host === PROD_HOST || host === METRICS_PROD_HOST;
  }

  if (environment === "development") {
    const configuredAppHost = appBaseUrl ? getOriginHost(appBaseUrl) : "";

    return (
      host === LOCAL_HOST ||
      host === DESKTOP_LOCAL_HOST ||
      host === configuredAppHost ||
      host === METRICS_LOCAL_HOST
    );
  }

  return false;
}
