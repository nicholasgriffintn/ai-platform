import type { SiteRecordOperationResponse } from "@ngriffin_uk/polychat-schemas";

import { SITE_PREVIEW_CHANNEL, sitePreviewRecordResultSchema } from "./preview-protocol.js";
import type { SiteRecordExecutor } from "./useSiteFrameBridge.js";

export function createSiteRecordClient(frameId: string, sessionId: string) {
  const pending = new Map<
    string,
    {
      resolve: (response: SiteRecordOperationResponse) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let disposed = false;
  const receive = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) {
      return;
    }

    const parsed = sitePreviewRecordResultSchema.safeParse(event.data);

    if (!parsed.success || parsed.data.frameId !== frameId || parsed.data.sessionId !== sessionId) {
      return;
    }

    const message = parsed.data;
    const request = pending.get(message.requestId);

    if (!request) {
      return;
    }

    clearTimeout(request.timer);
    pending.delete(message.requestId);
    if (message.result.ok) {
      request.resolve(message.result.response);
    } else {
      request.reject(new Error(message.result.error));
    }
  };

  window.addEventListener("message", receive);
  const execute: SiteRecordExecutor = (operation) =>
    new Promise((resolve, reject) => {
      if (disposed || pending.size >= 16) {
        reject(new Error("The preview is unavailable or busy"));

        return;
      }

      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("Record request timed out. Refresh the view before retrying."));
      }, 30_000);

      pending.set(requestId, { resolve, reject, timer });
      window.parent.postMessage(
        {
          channel: SITE_PREVIEW_CHANNEL,
          type: "records",
          frameId,
          sessionId,
          requestId,
          operation,
        },
        "*",
      );
    });
  const dispose = () => {
    disposed = true;
    window.removeEventListener("message", receive);
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("The Site preview changed. Reopen the current view."));
    }

    pending.clear();
  };

  return { execute, dispose };
}
