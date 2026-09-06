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

function findHeadTagEnd(documentContent: string): number {
  const lowered = documentContent.toLowerCase();
  let searchFrom = 0;

  while (searchFrom < lowered.length) {
    const start = lowered.indexOf("<head", searchFrom);

    if (start === -1) {
      return -1;
    }

    const afterName = start + "<head".length;
    const next = lowered[afterName];

    if (next === ">") {
      return afterName + 1;
    }

    if (next !== undefined && /\s/u.test(next)) {
      const close = lowered.indexOf(">", afterName);

      if (close !== -1) {
        return close + 1;
      }

      return -1;
    }

    searchFrom = afterName;
  }

  return -1;
}

export function hardenSandboxDocument(documentContent: string | null): string | undefined {
  if (!documentContent) {
    return undefined;
  }

  const policy = `<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_SANDBOX_CSP}">`;
  const headEnd = findHeadTagEnd(documentContent);

  if (headEnd === -1) {
    return documentContent;
  }

  return `${documentContent.slice(0, headEnd)}${policy}${documentContent.slice(headEnd)}`;
}

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
      className="h-full w-full border-0"
      sandbox="allow-scripts"
      title="Code Preview"
      onLoad={handleIframeLoad}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
