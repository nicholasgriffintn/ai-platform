const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function parseConfiguredHost(configuredHost: string | undefined): URL | null {
  const host = configuredHost?.trim();

  if (!host) {
    return null;
  }

  try {
    const parsed = new URL(`https://${host}`);

    if (
      parsed.host !== host ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.hostname.includes("*")
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function previewFrameSource(
  configuredHost: string | undefined,
  allowLocalHttp: boolean,
): string | undefined {
  const parsed = parseConfiguredHost(configuredHost);

  if (!parsed) {
    return undefined;
  }

  const protocol = allowLocalHttp && isLocalHost(parsed.hostname) ? "http:" : "https:";

  return `${protocol}//*.${parsed.host}`;
}

export function computerScreenFrameSource(
  configuredHost: string | undefined,
  allowLocalHttp: boolean,
): string | undefined {
  const parsed = parseConfiguredHost(configuredHost);

  if (!parsed) {
    return undefined;
  }

  const local = isLocalHost(parsed.hostname);
  const protocol = allowLocalHttp && local ? "http:" : "https:";

  return local ? `${protocol}//${parsed.host}` : `${protocol}//*.${parsed.host}`;
}
