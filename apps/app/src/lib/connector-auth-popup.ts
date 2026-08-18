import {
  recipeConnectorProviderSchema,
  requireExternalHttpUrl,
  type RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

export const CONNECTOR_AUTH_POPUP_NAME = "polychat-connector-auth";
const CONNECTOR_AUTH_MESSAGE_TYPE = "polychat:connector-auth:completed";
const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 720;
const POPUP_TIMEOUT_MS = 10 * 60 * 1000;
const POPUP_CLOSED_GRACE_MS = 250;

export type ConnectorAuthPopupOutcome = "aborted" | "closed" | "connected" | "timed_out";

function popupFeatures(): string {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2));

  return [
    "popup=yes",
    `width=${POPUP_WIDTH}`,
    `height=${POPUP_HEIGHT}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

export function openConnectorAuthPopup(): Window | null {
  const popup = window.open("", CONNECTOR_AUTH_POPUP_NAME, popupFeatures());

  popup?.focus();

  return popup;
}

export function navigateConnectorAuthPopup(popup: Window, authorizationUrl: string): void {
  popup.location.replace(requireExternalHttpUrl(authorizationUrl));
  popup.focus();
}

function readCompletionMessage(
  event: MessageEvent,
  popup: Window,
  provider: RecipeConnectorProvider,
): boolean {
  if (event.origin !== window.location.origin || event.source !== popup || !isRecord(event.data)) {
    return false;
  }

  return event.data.type === CONNECTOR_AUTH_MESSAGE_TYPE && event.data.provider === provider;
}

function popupHasCompletedConnection(popup: Window, provider: RecipeConnectorProvider): boolean {
  try {
    const popupUrl = new URL(popup.location.href);

    return (
      popupUrl.origin === window.location.origin &&
      popupUrl.searchParams.get("connected") === "1" &&
      popupUrl.searchParams.get("connector") === provider
    );
  } catch {
    return false;
  }
}

export function waitForConnectorAuthPopup(params: {
  popup: Window;
  provider: RecipeConnectorProvider;
  signal?: AbortSignal;
}): Promise<ConnectorAuthPopupOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let closedTimer: number | undefined;

    const finish = (outcome: ConnectorAuthPopupOutcome) => {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener("message", onMessage);
      params.signal?.removeEventListener("abort", onAbort);
      window.clearInterval(closedInterval);
      window.clearTimeout(timeout);
      if (closedTimer !== undefined) {
        window.clearTimeout(closedTimer);
      }

      if (outcome === "connected" && !params.popup.closed) {
        params.popup.close();
      }

      resolve(outcome);
    };

    const onMessage = (event: MessageEvent) => {
      if (readCompletionMessage(event, params.popup, params.provider)) {
        finish("connected");
      }
    };

    const onAbort = () => finish("aborted");
    const closedInterval = window.setInterval(() => {
      if (popupHasCompletedConnection(params.popup, params.provider)) {
        finish("connected");

        return;
      }

      if (!params.popup.closed || closedTimer !== undefined) {
        return;
      }

      closedTimer = window.setTimeout(() => finish("closed"), POPUP_CLOSED_GRACE_MS);
    }, 250);
    const timeout = window.setTimeout(() => finish("timed_out"), POPUP_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    params.signal?.addEventListener("abort", onAbort, { once: true });
    if (params.signal?.aborted) {
      finish("aborted");
    }
  });
}

export function completeConnectorAuthPopup(searchParams: URLSearchParams): boolean {
  if (
    window.name !== CONNECTOR_AUTH_POPUP_NAME ||
    !window.opener ||
    searchParams.get("connected") !== "1"
  ) {
    return false;
  }

  const provider = recipeConnectorProviderSchema.safeParse(searchParams.get("connector"));

  if (!provider.success) {
    return false;
  }

  window.opener.postMessage(
    { type: CONNECTOR_AUTH_MESSAGE_TYPE, provider: provider.data },
    window.location.origin,
  );
  window.close();

  return true;
}
