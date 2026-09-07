import { isInternalNavigationPath } from "@ngriffin_uk/polychat-schemas";

export const DEEP_LINK_SCHEME = "polychat:";
export const DEEP_LINK_EVENT = "polychat://deep-link";

const ALLOWED_ROOTS = new Set(["chat"]);

export function readDeepLinkPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== DEEP_LINK_SCHEME || !ALLOWED_ROOTS.has(url.hostname)) {
    return null;
  }

  const path = `/${url.hostname}${url.pathname}${url.search}`;

  return isInternalNavigationPath(path) ? path : null;
}
