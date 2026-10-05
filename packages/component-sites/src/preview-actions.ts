import {
  sitePreviewDataResultMessageSchema,
  type SiteDataAction,
  type SitePreviewDataActionMessage,
} from "@ngriffin_uk/polychat-schemas";

import { SITE_PREVIEW_CHANNEL } from "./preview-protocol.js";

export function createSitePreviewActions(frameId: string) {
  const pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  return {
    invoke(this: void, action: SiteDataAction): Promise<void> {
      if (window.parent === window) {
        return Promise.reject(new Error("Saved data is available in Sites"));
      }

      const requestId = crypto.randomUUID();

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error("The data action timed out. Refresh before retrying"));
        }, 30_000);

        pending.set(requestId, { resolve, reject, timer });
        window.parent.postMessage(
          { channel: SITE_PREVIEW_CHANNEL, type: "data-action", frameId, requestId, action },
          "*",
        );
      });
    },
    handleMessage(event: MessageEvent): void {
      const parsed = sitePreviewDataResultMessageSchema.safeParse(event.data);

      if (event.source !== window.parent || !parsed.success || parsed.data.frameId !== frameId) {
        return;
      }

      const message = parsed.data;
      const action = pending.get(message.requestId);

      if (!action) {
        return;
      }

      clearTimeout(action.timer);
      pending.delete(message.requestId);

      if (message.success) {
        action.resolve();
      } else {
        action.reject(
          new Error(
            typeof message.error === "string"
              ? message.error.slice(0, 1000)
              : "The data action failed",
          ),
        );
      }
    },
    dispose(): void {
      for (const action of pending.values()) {
        clearTimeout(action.timer);
        action.reject(new Error("The preview was closed"));
      }

      pending.clear();
    },
  };
}

export async function respondToSiteDataAction(
  frame: HTMLIFrameElement,
  message: SitePreviewDataActionMessage,
  handler?: (action: SiteDataAction) => Promise<unknown>,
): Promise<void> {
  const target = frame.contentWindow;
  const envelope = {
    channel: SITE_PREVIEW_CHANNEL,
    type: "data-action-result",
    frameId: message.frameId,
    requestId: message.requestId,
  };

  try {
    if (!handler) {
      throw new Error("Open this app in Sites to use saved data");
    }

    await handler(message.action);
    target?.postMessage({ ...envelope, success: true }, "*");
  } catch (error) {
    target?.postMessage(
      {
        ...envelope,
        success: false,
        error: (error instanceof Error ? error.message : "The action failed").slice(0, 1000),
      },
      "*",
    );
  }
}
