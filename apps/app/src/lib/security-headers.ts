import { generateCSP } from "~/constants";

const PERMISSIONS_POLICY = [
  "geolocation=()",
  "microphone=(self)",
  "camera=(self)",
  "payment=()",
].join(", ");

const STATIC_HEADERS: Record<string, string> = {
  "Content-Security-Policy": generateCSP(),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": PERMISSIONS_POLICY,
};

function isConnectorAuthCallback(url: URL): boolean {
  return (
    url.pathname === "/profile" &&
    url.searchParams.get("connected") === "1" &&
    Boolean(url.searchParams.get("connector"))
  );
}

export function applySecurityHeaders(headers: Headers, requestUrl: string): Headers {
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    headers.set(name, value);
  }

  const url = new URL(requestUrl);

  if (isConnectorAuthCallback(url)) {
    headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  }

  if (url.protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return headers;
}
