export function sandboxPreviewFrameSource(
  configuredHost: string | undefined,
  allowLocalHttp: boolean,
): string | undefined {
  const host = configuredHost?.trim();

  if (!host) {
    return undefined;
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
      return undefined;
    }

    const protocol = allowLocalHttp && parsed.hostname === "localhost" ? "http:" : "https:";

    return `${protocol}//*.${parsed.host}`;
  } catch {
    return undefined;
  }
}
