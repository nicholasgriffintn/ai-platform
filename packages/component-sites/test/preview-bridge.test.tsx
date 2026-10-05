import {
  DEFAULT_SITE_THEME,
  nativeRecordViewSchema,
  siteProjectSchema,
} from "@ngriffin_uk/polychat-schemas";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SITE_PREVIEW_CHANNEL,
  sitePreviewRenderMessageSchema,
  type SitePreviewRenderPayload,
} from "../src/preview-protocol.js";
import { useSiteFrameBridge } from "../src/useSiteFrameBridge.js";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const project = siteProjectSchema.parse({
  title: "Work",
  theme: DEFAULT_SITE_THEME,
  capabilities: [],
  pages: {},
  recordViews: [
    nativeRecordViewSchema.parse({
      id: "work",
      tableId: "table",
      title: "Work",
      presentation: "table",
    }),
  ],
});
const payload: SitePreviewRenderPayload = {
  project,
  pageId: null,
  inspecting: false,
  selectedKey: null,
  siteRevision: 1,
};

describe("saved Site preview authority", () => {
  it("accepts each request once from the current frame and revision, refusing spoofed messages", async () => {
    const frame = document.createElement("iframe");

    document.body.append(frame);
    if (!frame.contentWindow) {
      throw new Error("Missing preview window");
    }

    const send = vi.spyOn(frame.contentWindow, "postMessage").mockImplementation(() => {});
    const execute = vi.fn(async () => {
      throw new Error("Access denied");
    });

    renderHook(() =>
      useSiteFrameBridge({ frame, frameId: "frame", payload, onRecordOperation: execute }),
    );
    const initial = sitePreviewRenderMessageSchema.parse(send.mock.calls[0]?.[0]);
    const request = {
      channel: SITE_PREVIEW_CHANNEL,
      type: "records",
      frameId: "frame",
      sessionId: initial.sessionId,
      requestId: crypto.randomUUID(),
      operation: { operation: "query", viewId: "work", siteRevision: 1, offset: 0, limit: 100 },
    };
    const deliver = (data: unknown, source: Window | null) =>
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source }));
      });

    deliver(request, window);
    deliver({ ...request, sessionId: crypto.randomUUID() }, frame.contentWindow);
    deliver(
      { ...request, operation: { ...request.operation, siteRevision: 2 } },
      frame.contentWindow,
    );
    expect(execute).not.toHaveBeenCalled();
    const valid = { ...request, requestId: crypto.randomUUID() };

    deliver(valid, frame.contentWindow);
    deliver(valid, frame.contentWindow);
    await waitFor(() =>
      expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
        type: "record-result",
        requestId: valid.requestId,
        result: { ok: false, error: "Access denied" },
      }),
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it("drops replies and requests from an earlier render after the saved Site changes", async () => {
    const frame = document.createElement("iframe");

    document.body.append(frame);
    if (!frame.contentWindow) {
      throw new Error("Missing preview window");
    }

    const send = vi.spyOn(frame.contentWindow, "postMessage").mockImplementation(() => {});
    let fail: ((reason: Error) => void) | undefined;
    const execute = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const hook = renderHook(
      ({ current }) =>
        useSiteFrameBridge({
          frame,
          frameId: "frame",
          payload: current,
          onRecordOperation: execute,
        }),
      { initialProps: { current: payload } },
    );
    const initial = sitePreviewRenderMessageSchema.parse(send.mock.calls[0]?.[0]);
    const request = {
      channel: SITE_PREVIEW_CHANNEL,
      type: "records",
      frameId: "frame",
      sessionId: initial.sessionId,
      requestId: crypto.randomUUID(),
      operation: { operation: "query", viewId: "work", siteRevision: 1, offset: 0, limit: 100 },
    };

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: request, source: frame.contentWindow }),
      );
    });
    expect(execute).toHaveBeenCalledOnce();
    hook.rerender({ current: { ...payload, siteRevision: 2 } });
    const renders = send.mock.calls.length;

    await act(async () => {
      fail?.(new Error("Old response"));
    });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { ...request, requestId: crypto.randomUUID() },
          source: frame.contentWindow,
        }),
      );
    });
    expect(send).toHaveBeenCalledTimes(renders);
    expect(execute).toHaveBeenCalledOnce();
  });
});
