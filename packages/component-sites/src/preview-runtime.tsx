import {
  buildSiteThemeVariables,
  siteThemeClasses,
  SITE_EXPRESSION_CSS,
} from "@ngriffin_uk/polychat-library-sites";
import type { SiteTheme } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useMemo, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";

import {
  sitePreviewRenderMessageSchema,
  SITE_PREVIEW_CHANNEL,
  type SitePreviewRenderPayload,
  type SitePreviewRuntimeMessage,
} from "./preview-protocol.js";
import { createSiteRecordClient } from "./record-client.js";
import { SiteRecordProvider, type SiteRecordRuntime } from "./record-context.js";
import { SiteRenderer } from "./SiteRenderer.js";
import { readSiteSelectionFromEvent, SiteSelectionOverlay } from "./SiteSelection.js";
import { SiteNavigationProvider } from "./ui.js";

function applyTheme(theme: SiteTheme): void {
  const root = document.documentElement;

  for (const [name, value] of Object.entries(buildSiteThemeVariables(theme))) {
    root.style.setProperty(name, value);
  }

  root.className = [theme.mode === "dark" ? "dark" : "", siteThemeClasses(theme)]
    .filter(Boolean)
    .join(" ");
  root.dataset.siteMode = theme.mode;
}

function post(message: SitePreviewRuntimeMessage): void {
  window.parent.postMessage(message, "*");
}

function RuntimePreview({
  frameId,
  sessionId,
  payload,
  records,
}: {
  frameId: string;
  sessionId: string;
  payload: SitePreviewRenderPayload;
  records: SiteRecordRuntime;
}) {
  const page = payload.pageId ? payload.project.pages[payload.pageId] : null;
  const navigation = useMemo(
    () => ({
      navigate: (path: string) =>
        post({ channel: SITE_PREVIEW_CHANNEL, type: "navigate", frameId, sessionId, path }),
    }),
    [frameId, sessionId],
  );

  useEffect(() => applyTheme(payload.project.theme), [payload.project.theme]);

  const handleInspect = (event: MouseEvent) => {
    if (!payload.inspecting) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    post({
      channel: SITE_PREVIEW_CHANNEL,
      type: "select",
      frameId,
      sessionId,
      key: readSiteSelectionFromEvent(event),
    });
  };

  return (
    <SiteNavigationProvider value={navigation}>
      <SiteRecordProvider value={records}>
        <div
          data-site-inspecting={payload.inspecting || undefined}
          className={payload.inspecting ? "cursor-crosshair [&_a]:pointer-events-auto" : undefined}
          onClickCapture={handleInspect}
        >
          {page && payload.pageId ? <SiteRenderer key={payload.pageId} page={page} /> : null}
        </div>
        <SiteSelectionOverlay
          root={document.getElementById("site-root")}
          selectedKey={payload.selectedKey}
          active={payload.inspecting}
        />
      </SiteRecordProvider>
    </SiteNavigationProvider>
  );
}

function boot(): void {
  const mount = document.getElementById("site-root");
  const frameId = document.body.dataset.siteFrameId;

  if (!mount || !frameId) {
    return;
  }

  const expressionStyles = document.createElement("style");

  expressionStyles.dataset.siteExpressionStyles = "";
  expressionStyles.textContent = SITE_EXPRESSION_CSS;
  document.head.append(expressionStyles);

  const root = createRoot(mount);
  let client: ReturnType<typeof createSiteRecordClient> | null = null;
  let sessionId: string | null = null;
  let records: SiteRecordRuntime | null = null;

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) {
      return;
    }

    const parsed = sitePreviewRenderMessageSchema.safeParse(event.data);

    if (!parsed.success || parsed.data.frameId !== frameId) {
      return;
    }

    const message = parsed.data;

    if (message.sessionId !== sessionId) {
      client?.dispose();
      sessionId = message.sessionId;
      client = createSiteRecordClient(frameId, sessionId);
      records = { revision: message.payload.siteRevision, execute: client.execute };
    }

    if (records) {
      root.render(
        <RuntimePreview
          key={message.sessionId}
          frameId={frameId}
          sessionId={message.sessionId}
          records={records}
          payload={message.payload}
        />,
      );
    }
  });
  window.addEventListener("pagehide", () => client?.dispose());

  post({ channel: SITE_PREVIEW_CHANNEL, type: "ready", frameId });
}

boot();
