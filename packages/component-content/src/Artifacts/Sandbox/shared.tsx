import { hardenSandboxDocument } from "@ngriffin_uk/polychat-utility-core";
import type { RefObject } from "react";

export function LoadingIndicator() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface p-4 text-sm text-muted-foreground">
      Processing code...
    </div>
  );
}

export function SandboxIframe({
  documentContent,
  iframeKey,
  setPreviewError,
  iframeRef,
}: {
  documentContent: string | null;
  iframeKey: number;
  setPreviewError: (error: string | null) => void;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
}) {
  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const iframeDoc = e.currentTarget.contentDocument;
      const errorEl = iframeDoc?.querySelector(".error-container");

      if (errorEl) {
        setPreviewError(errorEl.textContent || "Unknown error");
      } else {
        setPreviewError(null);
      }
    } catch (err) {
      console.error("Error checking iframe:", err);
    }
  };

  return (
    <iframe
      ref={iframeRef}
      key={iframeKey}
      srcDoc={hardenSandboxDocument(documentContent)}
      className="h-full w-full border-0"
      sandbox="allow-scripts"
      title="Code Preview"
      onLoad={handleIframeLoad}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
