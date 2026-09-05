const ARTIFACT_SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "navigate-to 'none'",
].join("; ");

export function hardenSandboxDocument(documentContent: string | null): string | undefined {
  if (!documentContent) {
    return undefined;
  }

  const policy = `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_SANDBOX_CSP}">`;

  return documentContent.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${policy}`);
}

export function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-surface p-4 text-sm text-muted-foreground">
      Processing code...
    </div>
  );
}

export function SandboxIframe({
  documentContent,
  iframeKey,
  setPreviewError,
}: {
  documentContent: string | null;
  iframeKey: number;
  setPreviewError: (error: string | null) => void;
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
      key={iframeKey}
      srcDoc={hardenSandboxDocument(documentContent)}
      className="w-full h-full border-0"
      sandbox="allow-scripts"
      title="Code Preview"
      onLoad={handleIframeLoad}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
