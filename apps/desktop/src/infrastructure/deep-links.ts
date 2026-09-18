import { DISCOVER_PATH, MODE_BASE_PATHS, PROFILE_PATH } from "@ngriffin_uk/polychat-library-react";
import { isInternalNavigationPath } from "@ngriffin_uk/polychat-schemas";

export const DEEP_LINK_SCHEME = "polychat:";
export const DEEP_LINK_EVENT = "polychat://deep-link";

const ALLOWED_ROOTS = new Set(
  [MODE_BASE_PATHS.chat, MODE_BASE_PATHS.work, PROFILE_PATH, DISCOVER_PATH].map((path) =>
    path.replace(/^\//, ""),
  ),
);

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

export type DeepLinkListener = (
  event: string,
  handler: (event: { payload: unknown }) => void,
) => Promise<() => void>;

export function subscribeToDeepLinks(
  listen: DeepLinkListener,
  open: (path: string) => void,
): () => void {
  let stopped = false;
  let stopListening: (() => void) | undefined;

  const startListening = async () => {
    const stop = await listen(DEEP_LINK_EVENT, (event) => {
      const path = readDeepLinkPath(event.payload);

      if (path && !stopped) {
        open(path);
      }
    });

    stopListening = stop;

    if (stopped) {
      stop();
    }
  };

  const listening = startListening().catch(() => undefined);

  return () => {
    stopped = true;
    stopListening?.();
    void listening;
  };
}
