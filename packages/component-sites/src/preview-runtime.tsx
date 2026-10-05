import {
  buildSiteThemeVariables,
  getSitePageBoundState,
  siteThemeClasses,
  SITE_EXPRESSION_CSS,
} from "@ngriffin_uk/polychat-library-sites";
import { siteProjectSchema, type SiteTheme } from "@ngriffin_uk/polychat-schemas";
import { isRecord, safeParseJson } from "@ngriffin_uk/polychat-utility-core";
import { useEffect, useMemo, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";

import {
  isSitePreviewRenderMessage,
  SITE_PREVIEW_CHANNEL,
  type SitePreviewRenderPayload,
  type SitePreviewRuntimeMessage,
} from "./preview-protocol.js";
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
  payload,
}: {
  frameId: string;
  payload: SitePreviewRenderPayload;
}) {
  const page = payload.pageId ? payload.project.pages[payload.pageId] : null;
  const boundState = useMemo(
    () => getSitePageBoundState(payload.project, payload.pageId, payload.data),
    [payload.project, payload.pageId, payload.data],
  );
  const navigation = useMemo(
    () => ({
      navigate: (path: string) =>
        post({ channel: SITE_PREVIEW_CHANNEL, type: "navigate", frameId, path }),
    }),
    [frameId],
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
      key: readSiteSelectionFromEvent(event),
    });
  };

  return (
    <SiteNavigationProvider value={navigation}>
      <div
        data-site-inspecting={payload.inspecting || undefined}
        className={payload.inspecting ? "cursor-crosshair [&_a]:pointer-events-auto" : undefined}
        onClickCapture={handleInspect}
      >
        {page && payload.pageId ? (
          <SiteRenderer key={payload.pageId} page={page} boundState={boundState} />
        ) : null}
      </div>
      <SiteSelectionOverlay
        root={document.getElementById("site-root")}
        selectedKey={payload.selectedKey}
        active={payload.inspecting}
      />
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

  const initial = safeParseJson<unknown>(
    document.getElementById("site-initial-document")?.textContent ?? "",
  );

  if (isRecord(initial)) {
    const project = siteProjectSchema.safeParse(initial.project);

    if (
      project.success &&
      typeof initial.pageId === "string" &&
      Object.hasOwn(project.data.pages, initial.pageId)
    ) {
      root.render(
        <RuntimePreview
          frameId={frameId}
          payload={{
            project: project.data,
            pageId: initial.pageId,
            inspecting: false,
            selectedKey: null,
            data: isRecord(initial.data) ? initial.data : undefined,
          }}
        />,
      );
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || !isSitePreviewRenderMessage(event.data)) {
      return;
    }

    if (event.data.frameId !== frameId) {
      return;
    }

    root.render(<RuntimePreview frameId={frameId} payload={event.data.payload} />);
  });

  post({ channel: SITE_PREVIEW_CHANNEL, type: "ready", frameId });
}

boot();
