import type {
  SiteRecordOperation,
  SiteRecordOperationResponse,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useEffectEvent, useMemo } from "react";

import {
  SITE_PREVIEW_CHANNEL,
  sitePreviewRuntimeMessageSchema,
  sitePreviewRecordResultSchema,
  type SitePreviewRenderMessage,
  type SitePreviewRenderPayload,
} from "./preview-protocol.js";

export type SiteRecordExecutor = (
  operation: SiteRecordOperation,
) => Promise<SiteRecordOperationResponse>;

export function useSiteFrameBridge({
  frame,
  frameId,
  payload,
  onNavigate,
  onSelect,
  onRecordOperation,
}: {
  frame: HTMLIFrameElement | null;
  frameId: string;
  payload: SitePreviewRenderPayload;
  onNavigate?: (path: string) => void;
  onSelect?: (key: string | null) => void;
  onRecordOperation?: SiteRecordExecutor;
}) {
  const sessionId = useMemo(() => ({ payload, id: crypto.randomUUID() }), [payload]).id;
  const navigate = useEffectEvent((path: string) => onNavigate?.(path));
  const select = useEffectEvent((key: string | null) => onSelect?.(key));
  const execute = useEffectEvent(async (operation: SiteRecordOperation) => {
    if (!onRecordOperation || payload.siteRevision !== operation.siteRevision) {
      throw new Error("Open the current saved Site to use its records");
    }

    const view = payload.project.recordViews?.find((item) => item.id === operation.viewId);

    if (!view || (operation.operation !== "query" && !view.editable)) {
      throw new Error("This record operation is unavailable for the saved view");
    }

    return onRecordOperation(operation);
  });

  useEffect(() => {
    const target = frame?.contentWindow;

    if (!target) {
      return undefined;
    }

    let active = true;
    let inFlight = 0;
    const seen = new Set<string>();
    const sendRender = () => {
      const message: SitePreviewRenderMessage = {
        channel: SITE_PREVIEW_CHANNEL,
        type: "render",
        frameId,
        sessionId,
        payload,
      };

      target.postMessage(message, "*");
    };

    const handleMessage = async (event: MessageEvent<unknown>) => {
      if (event.source !== target) {
        return;
      }

      const parsed = sitePreviewRuntimeMessageSchema.safeParse(event.data);

      if (!parsed.success || parsed.data.frameId !== frameId) {
        return;
      }

      const message = parsed.data;

      if (message.type === "ready") {
        sendRender();

        return;
      }

      if (message.sessionId !== sessionId) {
        return;
      }

      if (message.type === "navigate") {
        navigate(message.path);

        return;
      }

      if (message.type === "select") {
        select(message.key);

        return;
      }

      if (seen.has(message.requestId)) {
        return;
      }

      if (seen.size >= 256) {
        const oldest = seen.values().next().value;

        if (oldest) {
          seen.delete(oldest);
        }
      }

      seen.add(message.requestId);
      const reply = (
        result: { ok: true; response: SiteRecordOperationResponse } | { ok: false; error: string },
      ) => {
        if (!active) {
          return;
        }

        target.postMessage(
          sitePreviewRecordResultSchema.parse({
            channel: SITE_PREVIEW_CHANNEL,
            type: "record-result",
            frameId,
            sessionId,
            requestId: message.requestId,
            result,
          }),
          "*",
        );
      };

      if (inFlight >= 16) {
        reply({ ok: false, error: "Too many record requests. Reload the preview." });

        return;
      }

      inFlight += 1;
      try {
        reply({ ok: true, response: await execute(message.operation) });
      } catch (error) {
        reply({
          ok: false,
          error: getErrorMessage(error, "Records are unavailable").slice(0, 500),
        });
      } finally {
        inFlight -= 1;
      }
    };

    const receive = (event: MessageEvent<unknown>) => void handleMessage(event);

    window.addEventListener("message", receive);
    sendRender();

    return () => {
      active = false;
      window.removeEventListener("message", receive);
    };
  }, [frame, frameId, payload, sessionId]);
}
