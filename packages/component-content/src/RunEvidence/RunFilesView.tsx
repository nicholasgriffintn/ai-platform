import { Badge, Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { File, FileArchive, FileWarning } from "lucide-react";
import { useMemo } from "react";

import { parseUnifiedDiff } from "./parseUnifiedDiff";
import type { RunEvidenceContent } from "./RunChangesView";
import { useRunArtifactPreview, type RunArtifactItem } from "./useRunArtifactPreview";

const EMPTY_RECORDED_FILES: string[] = [];

export interface RunFilesViewProps {
  diffContent?: RunEvidenceContent;
  recordedFiles?: string[];
  artifacts: RunArtifactItem[];
  loadArtifact: (outputId: string) => Promise<RunEvidenceContent>;
}

function ArtifactPreview({
  status,
  artifact,
  content,
  errorMessage,
}: ReturnType<typeof useRunArtifactPreview>) {
  if (status === "idle" || !artifact) {
    return (
      <EmptyState
        icon={<FileArchive className="text-muted-foreground size-5" />}
        title="Choose an artifact"
        message="Content is fetched through its authorised Output when you open it."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (status === "loading") {
    return (
      <EmptyState
        icon={<FileArchive className="text-muted-foreground size-5" />}
        title={`Loading ${artifact.name}`}
        message="Fetching a bounded preview…"
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (status === "failed" || !content) {
    return (
      <EmptyState
        icon={<FileWarning className="text-failure size-5" />}
        title="Artifact unavailable"
        message={errorMessage ?? "The authorised content could not be loaded."}
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (content.binary) {
    return (
      <EmptyState
        icon={<FileWarning className="text-muted-foreground size-5" />}
        title="Binary artifact"
        message="This file is recorded but cannot be previewed safely as text."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  return (
    <section aria-label={`Preview of ${artifact.name}`} className="min-w-0 space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-mono text-sm">{artifact.name}</h3>
        <Badge variant="outline">{artifact.kind}</Badge>
      </div>
      {content.truncated ? (
        <output className="bg-attention/10 text-attention block rounded-lg px-3 py-2 text-sm">
          This artifact is too large to render in full. Showing a bounded preview.
        </output>
      ) : null}
      <pre className="border-border bg-canvas text-foreground max-h-[34rem] overflow-auto rounded-lg border p-3 text-xs leading-5">
        <code>{content.text}</code>
      </pre>
    </section>
  );
}

export function RunFilesView({
  diffContent,
  recordedFiles = EMPTY_RECORDED_FILES,
  artifacts,
  loadArtifact,
}: RunFilesViewProps) {
  const changedFiles = useMemo(
    () => parseUnifiedDiff(diffContent?.text ?? ""),
    [diffContent?.text],
  );
  const preview = useRunArtifactPreview(loadArtifact);
  const visibleFiles =
    changedFiles.length > 0
      ? changedFiles.map((file) => ({ path: file.path, status: file.status }))
      : recordedFiles.map((path) => ({ path, status: "recorded" }));

  if (visibleFiles.length === 0 && artifacts.length === 0) {
    return (
      <EmptyState
        icon={<File className="text-muted-foreground size-5" />}
        title="No file evidence available"
        message="Changed files and private run artifacts will appear here when recorded."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(12rem,0.34fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section aria-labelledby="changed-files-heading">
          <h3
            id="changed-files-heading"
            className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase"
          >
            Changed files
          </h3>
          {visibleFiles.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {visibleFiles.map((file) => (
                <li key={file.path} className="px-2 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <File className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                    <Badge variant="outline">{file.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-2 py-2 text-sm">No text diff available</p>
          )}
        </section>

        <section aria-labelledby="run-artifacts-heading">
          <h3
            id="run-artifacts-heading"
            className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase"
          >
            Run artifacts
          </h3>
          {artifacts.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {artifacts.map((artifact) => (
                <li key={artifact.outputId}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    aria-pressed={preview.artifact?.outputId === artifact.outputId}
                    onClick={() => void preview.selectArtifact(artifact)}
                    icon={<FileArchive className="size-4" />}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{artifact.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-2 py-2 text-sm">No private artifacts recorded</p>
          )}
        </section>
      </div>

      <ArtifactPreview {...preview} />
    </div>
  );
}
