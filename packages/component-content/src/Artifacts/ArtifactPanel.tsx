import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { Code2, Copy, FileText, Play, X } from "lucide-react";
import { Suspense, lazy, useCallback, useMemo, useState } from "react";

import { MemoizedMarkdown } from "../markdown";
import type { ArtifactProps } from "./artifact";
import {
  isCodeArtifact,
  isDocumentArtifact,
  isPreviewableArtifact,
  isStylesheetArtifact,
} from "./artifact-kinds";
import { ArtifactDocumentEditor } from "./ArtifactDocumentEditor";

const ArtifactSandbox = lazy(() =>
  import("./Sandbox").then((mod) => ({ default: mod.ArtifactSandbox })),
);

const SandboxLoading = () => (
  <div className="flex h-full w-full items-center justify-center bg-surface p-4 text-sm text-muted-foreground">
    Loading sandbox...
  </div>
);

const FileTabs = ({
  artifacts,
  activeIndex,
  onSelectTab,
}: {
  artifacts: ArtifactProps[];
  activeIndex: number;
  onSelectTab: (index: number) => void;
}) => {
  return (
    <div className="file-tabs flex overflow-x-auto border-b border-border px-1 whitespace-nowrap">
      {artifacts.map((artifact, index) => (
        <button
          key={artifact.identifier || index}
          type="button"
          className={`inline-block px-3 py-2 text-xs ${
            activeIndex === index
              ? "border-b-2 border-active-work font-medium text-active-work"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onSelectTab(index)}
        >
          {artifact.title || artifact.identifier || `File ${index + 1}`}
        </button>
      ))}
    </div>
  );
};

const ContentViewer = ({
  artifact,
  showCopyButton,
  onCopy,
  copied,
}: {
  artifact: ArtifactProps;
  showCopyButton: boolean;
  onCopy: () => void;
  copied: boolean;
}) => {
  const isMarkdown =
    artifact.type === "text/markdown" ||
    artifact.language?.toLowerCase() === "markdown" ||
    artifact.language?.toLowerCase() === "md";

  return (
    <div className="flex-1 overflow-auto p-3">
      {(artifact.language || showCopyButton) && (
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {artifact.language && (
              <span className="rounded bg-surface-elevated px-2 py-1 text-foreground">
                {artifact.language}
              </span>
            )}
          </div>
          {showCopyButton && (
            <Button
              variant="icon"
              size="sm"
              onClick={onCopy}
              title={copied ? "Copied!" : "Copy file"}
              aria-label={copied ? "Copied to clipboard" : "Copy file"}
            >
              <Copy size={14} className={copied ? "text-success" : ""} />
            </Button>
          )}
        </div>
      )}
      <div className="artifact-content-full min-w-0">
        <div className="prose max-w-none overflow-x-auto dark:prose-invert">
          <MemoizedMarkdown>
            {isMarkdown
              ? artifact.content
              : `\`\`\`${artifact.language}\n${artifact.content}\n\`\`\``}
          </MemoizedMarkdown>
        </div>
      </div>
    </div>
  );
};

export interface ArtifactWorkbenchPanelProps {
  artifact: ArtifactProps | null;
  artifacts?: ArtifactProps[];
  onClose: () => void;
  onAddSelectionToChat?: (attachment: AttachmentData) => void;
  isCombined?: boolean;
  copied: boolean;
  onCopy: (value: string) => void;
}

const EMPTY_ARTIFACTS: ArtifactProps[] = [];

function resolveArtifactList(
  artifact: ArtifactProps | null,
  artifacts: ArtifactProps[],
  isCombined: boolean,
): ArtifactProps[] {
  if (isCombined && artifacts.length > 0) {
    return artifacts;
  }

  if (artifact) {
    return [artifact];
  }

  return [];
}

const ArtifactPanelContent = ({
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  onClose,
  onAddSelectionToChat,
  isCombined = false,
  copied,
  onCopy,
  titleId,
}: ArtifactWorkbenchPanelProps & { titleId: string }) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const allArtifacts = useMemo(() => {
    return resolveArtifactList(artifact, artifacts, isCombined);
  }, [artifact, artifacts, isCombined]);

  const codeArtifact = useMemo(
    () => allArtifacts.find((candidate) => isPreviewableArtifact(candidate)),
    [allArtifacts],
  );

  const cssArtifact = useMemo(
    () => allArtifacts.find((candidate) => isStylesheetArtifact(candidate)),
    [allArtifacts],
  );

  const showPreviewTab = useMemo(() => codeArtifact !== undefined, [codeArtifact]);

  const currentArtifact = useMemo(() => {
    return allArtifacts[activeFileIndex] || allArtifacts[0] || null;
  }, [allArtifacts, activeFileIndex]);

  const showFileTabs = useMemo(() => allArtifacts.length > 1, [allArtifacts.length]);
  const isDocument = useMemo(
    () => (currentArtifact ? isDocumentArtifact(currentArtifact) : false),
    [currentArtifact],
  );

  const isCode = useMemo(() => {
    if (!artifact) {
      return false;
    }

    return isCodeArtifact(artifact);
  }, [artifact]);
  const icon = useMemo(() => (isCode ? <Code2 size={16} /> : <FileText size={16} />), [isCode]);

  const [prevArtifactsLength, setPrevArtifactsLength] = useState(allArtifacts.length);

  if (prevArtifactsLength !== allArtifacts.length) {
    setPrevArtifactsLength(allArtifacts.length);
    setActiveFileIndex(0);
  }

  const handleCopyCurrentFile = useCallback(() => {
    if (currentArtifact) {
      onCopy(currentArtifact.content);
    }
  }, [currentArtifact, onCopy]);

  const handleCopyAllFiles = useCallback(() => {
    const combinedContent = allArtifacts
      .map(
        (a) => `// ${a.title || a.identifier} (${a.language || "unknown language"})\n${a.content}`,
      )
      .join("\n\n");

    onCopy(combinedContent);
  }, [allArtifacts, onCopy]);

  const handleTabSelect = useCallback((index: number) => {
    setActiveFileIndex(index);
  }, []);

  const handleSetActiveTab = useCallback((tab: "code" | "preview") => {
    setActiveTab(tab);

    if (tab === "preview") {
      setPreviewError(null);
      setIframeKey((prev) => prev + 1);
    }
  }, []);

  if (allArtifacts.length === 0 || !currentArtifact) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-foreground">
          {icon}
          <span id={titleId} className="truncate text-sm font-semibold text-foreground">
            {allArtifacts.length > 1
              ? `Combined Artifacts (${allArtifacts.length})`
              : currentArtifact.title || "Artifact"}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {!showFileTabs && !isDocument && (
            <Button
              variant="icon"
              size="sm"
              onClick={handleCopyCurrentFile}
              title={copied ? "Copied!" : "Copy content"}
              aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            >
              <Copy size={14} className={copied ? "text-success" : ""} />
            </Button>
          )}
          <Button
            variant="icon"
            size="sm"
            onClick={onClose}
            title="Close artifact"
            aria-label="Close artifact"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {showPreviewTab && (
        <div className="flex border-b border-border">
          <button
            type="button"
            className={`px-3 py-1.5 text-[13px] font-medium ${
              activeTab === "code"
                ? "border-b-2 border-active-work text-active-work"
                : "text-muted-foreground"
            }`}
            onClick={() => handleSetActiveTab("code")}
          >
            <div className="flex items-center gap-1.5">
              <Code2 size={14} />
              Code
            </div>
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-[13px] font-medium ${
              activeTab === "preview"
                ? "border-b-2 border-active-work text-active-work"
                : "text-muted-foreground"
            }`}
            onClick={() => handleSetActiveTab("preview")}
          >
            <div className="flex items-center gap-1.5">
              <Play size={14} />
              Preview
            </div>
          </button>
          {activeTab === "preview" && showFileTabs && (
            <div className="ml-auto flex items-center pr-1">
              <Button
                variant="icon"
                size="sm"
                onClick={handleCopyAllFiles}
                title={copied ? "Copied!" : "Copy all files"}
                aria-label={copied ? "Copied to clipboard" : "Copy all files"}
              >
                <Copy size={14} className={copied ? "text-success" : ""} />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden bg-surface text-foreground">
        {(activeTab === "code" || !showPreviewTab) && (
          <>
            {showFileTabs && (
              <FileTabs
                artifacts={allArtifacts}
                activeIndex={activeFileIndex}
                onSelectTab={handleTabSelect}
              />
            )}

            {isDocument ? (
              <ArtifactDocumentEditor
                artifact={currentArtifact}
                onAddSelectionToChat={onAddSelectionToChat}
              />
            ) : (
              <ContentViewer
                artifact={currentArtifact}
                showCopyButton={showFileTabs}
                onCopy={handleCopyCurrentFile}
                copied={copied}
              />
            )}
          </>
        )}

        {activeTab === "preview" && codeArtifact && (
          <div className="flex h-full flex-col">
            <div className="bg-surface-elevated p-2 text-xs text-muted-foreground">
              Live Preview (React + DOM)
            </div>

            {previewError && (
              <div className="m-3 rounded border border-failure/45 bg-failure/12 p-3 text-sm text-failure">
                <h4 className="mb-1 font-medium">Error rendering preview:</h4>
                <pre className="overflow-auto text-xs whitespace-pre-wrap">{previewError}</pre>
              </div>
            )}

            <div className="flex-1 bg-surface">
              <Suspense fallback={<SandboxLoading />}>
                <ArtifactSandbox
                  code={codeArtifact}
                  css={cssArtifact}
                  setPreviewError={setPreviewError}
                  iframeKey={iframeKey}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ArtifactWorkbenchPanel = ({
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  onClose,
  onAddSelectionToChat,
  isCombined = false,
  copied,
  onCopy,
}: ArtifactWorkbenchPanelProps) => {
  const allArtifacts = useMemo(() => {
    return resolveArtifactList(artifact, artifacts, isCombined);
  }, [artifact, artifacts, isCombined]);

  if (allArtifacts.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ArtifactPanelContent
        artifact={artifact}
        artifacts={artifacts}
        onClose={onClose}
        onAddSelectionToChat={onAddSelectionToChat}
        isCombined={isCombined}
        copied={copied}
        onCopy={onCopy}
        titleId="artifact-workbench-title"
      />
    </div>
  );
};
