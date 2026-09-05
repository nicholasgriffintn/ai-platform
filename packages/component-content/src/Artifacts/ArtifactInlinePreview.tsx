import { AppWindow, AlertTriangle, Loader2 } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import type { ArtifactProps } from "./artifact";
import { isStylesheetArtifact } from "./artifact-kinds";

const ArtifactSandbox = lazy(() =>
  import("./Sandbox/index").then((mod) => ({
    default: mod.ArtifactSandbox,
  })),
);

interface ArtifactInlinePreviewProps {
  artifact: ArtifactProps;
  artifacts?: ArtifactProps[];
  isGenerating?: boolean;
}

const EMPTY_ARTIFACTS: ArtifactProps[] = [];

const InlinePreviewLoading = () => (
  <div className="flex h-full w-full items-center justify-center bg-surface p-4 text-sm text-muted-foreground">
    Loading preview...
  </div>
);

export function ArtifactInlinePreview({
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  isGenerating = false,
}: ArtifactInlinePreviewProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const cssArtifact = useMemo(
    () => artifacts.find((item) => isStylesheetArtifact(item)),
    [artifacts],
  );
  const title = artifact.title || artifact.identifier || "Inline artifact";

  useEffect(() => {
    setPreviewError(null);
    setIframeKey((currentKey) => currentKey + 1);
  }, [artifact.content, artifact.identifier]);

  return (
    <section
      aria-label={`Inline artifact preview: ${title}`}
      aria-busy={isGenerating}
      className="my-3 overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <AppWindow size={14} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">Inline HTML preview</div>
          </div>
        </div>
        <span className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-muted-foreground">
          Preview
        </span>
      </div>

      {previewError && (
        <div className="m-3 flex gap-2 rounded-md border border-failure/45 bg-failure/12 p-3 text-sm text-failure">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <pre className="min-w-0 whitespace-pre-wrap text-xs">{previewError}</pre>
        </div>
      )}

      <div
        data-inline-preview-viewport="true"
        className="relative h-[75vh] min-h-[420px] bg-surface"
      >
        <Suspense fallback={<InlinePreviewLoading />}>
          <ArtifactSandbox
            code={artifact}
            css={cssArtifact}
            setPreviewError={setPreviewError}
            iframeKey={iframeKey}
          />
        </Suspense>
        {isGenerating && (
          <output
            aria-label="Updating preview"
            className="absolute inset-0 z-10 flex items-center justify-center bg-surface backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 rounded-full border border-border/80 bg-surface px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
              <Loader2
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>Updating preview…</span>
            </div>
          </output>
        )}
      </div>
    </section>
  );
}
