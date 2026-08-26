import { AssistantError, ErrorType } from "~/utils/errors";
import { isPrivateHostname } from "~/utils/urls";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Maximum number of redirect hops to follow. Each hop is re-validated against
 * the same scheme/hostname rules as the original request so a public URL can't
 * be used to bounce a request at a private or non-http(s) target.
 */
const MAX_REDIRECTS = 5;

/**
 * Parses and validates a user-supplied URL before it is used for a
 * server-side outbound request. This only rejects literal loopback,
 * link-local, and private/reserved IP ranges (plus localhost/.local/.internal
 * hostnames) and non-http(s) schemes.
 *
 * It cannot detect a public hostname that resolves (now or later, via DNS
 * rebinding) to a private address: the Workers runtime resolves DNS inside
 * `fetch` itself and does not expose the resolved IP to caller code, so there
 * is no way to pin or inspect it from here. Treat this as a defence against
 * obviously-private targets, not a complete SSRF barrier.
 */
export function parsePublicHttpUrl(rawUrl: string): URL {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new AssistantError("Invalid URL", ErrorType.PARAMS_ERROR);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new AssistantError("Only http and https URLs are supported", ErrorType.PARAMS_ERROR);
  }

  if (isPrivateHostname(url.hostname)) {
    throw new AssistantError(
      "Private or local network URLs are not allowed",
      ErrorType.PARAMS_ERROR,
    );
  }

  return url;
}

/**
 * Fetches a user-supplied URL, validating both the initial target and every
 * redirect hop. `redirect: "manual"` is required so we can inspect and
 * re-validate each `Location` header ourselves instead of letting the
 * runtime silently follow a redirect to a private or non-http(s) target.
 */
export async function fetchPublicUrl(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = parsePublicHttpUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl.toString(), {
      ...init,
      redirect: "manual",
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = isRedirect ? response.headers.get("location") : null;

    if (!location) {
      return response;
    }

    if (hop === MAX_REDIRECTS) {
      throw new AssistantError("Too many redirects", ErrorType.PARAMS_ERROR);
    }

    let resolvedLocation: string;

    try {
      resolvedLocation = new URL(location, currentUrl).toString();
    } catch {
      throw new AssistantError("Invalid redirect target", ErrorType.PARAMS_ERROR);
    }

    currentUrl = parsePublicHttpUrl(resolvedLocation);
  }

  throw new AssistantError("Too many redirects", ErrorType.PARAMS_ERROR);
}
