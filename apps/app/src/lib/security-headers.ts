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

export function applySecurityHeaders(headers: Headers, requestUrl: string): Headers {
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    headers.set(name, value);
  }

  if (new URL(requestUrl).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return headers;
}
