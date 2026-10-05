import { cn } from "@ngriffin_uk/polychat-component-ui";
import { buildSiteGoogleFontsUrl } from "@ngriffin_uk/polychat-library-sites";
import { useId, useMemo, useState } from "react";

import SITE_PREVIEW_RUNTIME_URL from "../dist/preview-runtime.global.js?url";
import { buildSiteFrameDocument } from "./frame-document.js";
import type { SitePreviewRenderPayload } from "./preview-protocol.js";
import { useSiteFrameBridge, type SiteRecordExecutor } from "./useSiteFrameBridge.js";

import SITE_PREVIEW_STYLESHEET_URL from "../dist/styles.css?url";

export interface SiteFrameProps {
  payload: SitePreviewRenderPayload;
  width: string;
  title: string;
  className?: string;
  onNavigate?: (path: string) => void;
  onSelect?: (key: string | null) => void;
  onRecordOperation?: SiteRecordExecutor;
}

export function SiteFrame({
  payload,
  width,
  title,
  className,
  onNavigate,
  onSelect,
  onRecordOperation,
}: SiteFrameProps) {
  const reactId = useId();
  const frameId = `site-frame-${reactId.replaceAll(":", "")}`;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const documentContent = useMemo(
    () =>
      buildSiteFrameDocument({
        frameId,
        title,
        fontUrl: buildSiteGoogleFontsUrl(payload.project.theme.font),
        runtimeUrl: SITE_PREVIEW_RUNTIME_URL,
        stylesheetUrl: SITE_PREVIEW_STYLESHEET_URL,
      }),
    [frameId, payload.project.theme.font, title],
  );

  useSiteFrameBridge({ frame, frameId, payload, onNavigate, onSelect, onRecordOperation });

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
