import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  buildSiteFrameDocument,
  buildSiteGoogleFontsUrl,
  type SiteFrameInlineAssets,
} from "@ngriffin_uk/polychat-library-sites";
import { useEffect, useId, useMemo, useState } from "react";

import SITE_PREVIEW_RUNTIME_URL from "../dist/preview-runtime.global.js?url";
import {
  isSitePreviewRuntimeMessage,
  SITE_PREVIEW_CHANNEL,
  type SitePreviewRenderMessage,
  type SitePreviewRenderPayload,
} from "./preview-protocol.js";

import SITE_PREVIEW_STYLESHEET_URL from "../dist/styles.css?url";

export interface SiteFrameProps {
  payload: SitePreviewRenderPayload;
  width: string;
  title: string;
  className?: string;
  onNavigate?: (path: string) => void;
  onSelect?: (key: string | null) => void;
}

let inlineAssetsRequest: Promise<SiteFrameInlineAssets> | null = null;

function loadInlineAssets(): Promise<SiteFrameInlineAssets> {
  inlineAssetsRequest ??= Promise.all([
    fetch(SITE_PREVIEW_RUNTIME_URL).then((response) => response.text()),
    fetch(SITE_PREVIEW_STYLESHEET_URL, { headers: { Accept: "text/css" } }).then((response) =>
      response.text(),
    ),
  ]).then(([runtime, stylesheet]) => ({ runtime, stylesheet }));

  return inlineAssetsRequest;
}

export function SiteFrame({
  payload,
  width,
  title,
  className,
  onNavigate,
  onSelect,
}: SiteFrameProps) {
  const reactId = useId();
  const frameId = `site-frame-${reactId.replaceAll(":", "")}`;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [inlineAssets, setInlineAssets] = useState<SiteFrameInlineAssets | null>(null);
  const fontUrl = buildSiteGoogleFontsUrl(payload.project.theme);
  const documentContent = useMemo(
    () =>
      buildSiteFrameDocument({
        frameId,
        title,
        fontUrl,
        runtimeUrl: SITE_PREVIEW_RUNTIME_URL,
        stylesheetUrl: SITE_PREVIEW_STYLESHEET_URL,
        runtimeFailureMessage: {
          channel: SITE_PREVIEW_CHANNEL,
          type: "runtime-failed",
          frameId,
        },
        inlineAssets,
      }),
    [frameId, fontUrl, inlineAssets, title],
  );

  useEffect(() => {
    if (!frame?.contentWindow) {
      return undefined;
    }

    const sendRender = () => {
      const message: SitePreviewRenderMessage = {
        channel: SITE_PREVIEW_CHANNEL,
        type: "render",
        frameId,
        payload,
      };

      frame.contentWindow?.postMessage(message, "*");
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== frame.contentWindow ||
        !isSitePreviewRuntimeMessage(event.data) ||
        event.data.frameId !== frameId
      ) {
        return;
      }

      if (event.data.type === "ready") {
        sendRender();
      } else if (event.data.type === "runtime-failed") {
        void loadInlineAssets().then(setInlineAssets);
      } else if (event.data.type === "navigate") {
        onNavigate?.(event.data.path);
      } else {
        onSelect?.(event.data.key);
      }
    };

    window.addEventListener("message", handleMessage);
    sendRender();

    return () => window.removeEventListener("message", handleMessage);
  }, [frame, frameId, onNavigate, onSelect, payload]);

  return (
    <iframe
      ref={setFrame}
      title={title}
      srcDoc={documentContent}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      style={{ width, maxWidth: "100%" }}
      className={cn("block h-full min-h-full shrink-0 border-0 bg-background", className)}
    />
  );
}
