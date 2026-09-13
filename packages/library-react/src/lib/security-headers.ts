import { generateCSP } from "@ngriffin_uk/polychat-library-client";

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

const HASHED_ASSET_PATTERN =
  /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(?:js|css|woff2?|png|svg|ico|webp|avif|mp3|json)$/;

const LONG_LIVED_STATIC_PATHS = new Set([
  "/site.webmanifest",
  "/opensearch.xml",
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-96x96.png",
  "/apple-touch-icon.png",
  "/sw.js",
]);

function isLongLivedStaticPath(pathname: string): boolean {
  if (LONG_LIVED_STATIC_PATHS.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/ios/") || pathname.startsWith("/android/");
}

export function applyCacheHeaders(headers: Headers, requestUrl: string): Headers {
  const { pathname } = new URL(requestUrl);

  if (HASHED_ASSET_PATTERN.test(pathname)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (isLongLivedStaticPath(pathname)) {
    headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
  }

  return headers;
}
