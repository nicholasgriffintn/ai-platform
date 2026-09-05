import { Button, useOverlayDismiss } from "@ngriffin_uk/polychat-component-ui";
import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import { Code2, Copy, FileText, Play, X } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

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
  <div className="flex items-center justify-center h-full w-full bg-surface p-4 text-sm text-muted-foreground">
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
    <div className="file-tabs overflow-x-auto whitespace-nowrap px-1 border-b border-border flex">
      {artifacts.map((artifact, index) => (
        <button
          key={artifact.identifier || index}
          type="button"
          className={`py-2 px-3 text-xs inline-block ${
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
    <div className="p-4 flex-1 overflow-auto">
      <div className="mb-2 text-xs text-muted-foreground flex justify-between items-center">
        <div>
          {artifact.language && (
            <span className="mr-2 px-2 py-1 bg-surface-elevated rounded text-foreground">
              {artifact.language}
            </span>
          )}
          <span className="font-medium">{artifact.title || artifact.identifier}</span>
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
      <div className="artifact-content-full">
        <div className="prose dark:prose-invert max-w-none">
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

export interface ArtifactPanelProps {
  artifact: ArtifactProps | null;
  artifacts?: ArtifactProps[];
  onClose: () => void;
  onAddSelectionToChat?: (attachment: AttachmentData) => void;
  isVisible: boolean;
  isCombined?: boolean;
  copied: boolean;
  onCopy: (value: string) => void;
}

const EMPTY_ARTIFACTS: ArtifactProps[] = [];

export const ArtifactPanel = ({
  artifact,
  artifacts = EMPTY_ARTIFACTS,
  onClose,
  onAddSelectionToChat,
  isVisible,
  isCombined = false,
  copied,
  onCopy,
}: ArtifactPanelProps) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const allArtifacts = useMemo(() => {
    if (isCombined && artifacts.length > 0) {
      return artifacts;
    }

    if (artifact) {
      return [artifact];
    }

    return [];
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
  const icon = useMemo(() => (isCode ? <Code2 size={20} /> : <FileText size={20} />), [isCode]);

  useEffect(() => {
    setActiveFileIndex(0);
  }, [allArtifacts.length]);

  useEffect(() => {
    if (activeTab === "preview") {
      setPreviewError(null);
      setIframeKey((prev) => prev + 1);
    }
  }, [activeTab]);

  // Keep the conversation interactive whether the panel overlays it or sits beside it.
  // Focus still moves in, Escape closes, and focus returns to the opener.
  const isOpen = isVisible && allArtifacts.length > 0;
  const panelRef = useOverlayDismiss<HTMLDivElement>({ open: isOpen, onClose });

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
  }, []);

  if (allArtifacts.length === 0 || !currentArtifact) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="artifact-panel-title"
      tabIndex={-1}
      // Closed, the panel is only translated off-screen, so hide it from tab order too.
      inert={!isVisible}
      className={`absolute right-0 top-0 h-full 
 w-full 2xl:w-[650px]
 bg-surface border-l border-border shadow-xl z-50 transition-transform duration-300 ease-in-out ${isVisible ? "translate-x-0" : "translate-x-full"} `}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground min-w-0 flex-1 overflow-hidden">
            {icon}
            <span
              id="artifact-panel-title"
              className="font-semibold text-lg text-foreground truncate"
            >
              {allArtifacts.length > 1
                ? `Combined Artifacts (${allArtifacts.length})`
                : currentArtifact.title || "Artifact"}
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-2">
            {!showFileTabs && !isDocument && (
              <Button
                variant="icon"
                onClick={handleCopyCurrentFile}
                title={copied ? "Copied!" : "Copy content"}
                aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
              >
                <Copy size={16} className={copied ? "text-success" : ""} />
              </Button>
            )}
            <Button variant="icon" onClick={onClose} title="Close panel" aria-label="Close panel">
              <X size={16} />
            </Button>
          </div>
        </div>

        {showPreviewTab && (
          <div className="flex border-b border-border">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "code"
                  ? "border-b-2 border-active-work text-active-work"
                  : "text-muted-foreground"
              }`}
              onClick={() => handleSetActiveTab("code")}
            >
              <div className="flex items-center gap-2">
                <Code2 size={16} />
                Code
              </div>
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "preview"
                  ? "border-b-2 border-active-work text-active-work"
                  : "text-muted-foreground"
              }`}
              onClick={() => handleSetActiveTab("preview")}
            >
              <div className="flex items-center gap-2">
                <Play size={16} />
                Preview
              </div>
            </button>
            {activeTab === "preview" && showFileTabs && (
              <div className="ml-auto pr-2">
                <Button
                  variant="icon"
                  onClick={handleCopyAllFiles}
                  title={copied ? "Copied!" : "Copy all files"}
                  aria-label={copied ? "Copied to clipboard" : "Copy all files"}
                >
                  <Copy size={16} className={copied ? "text-success" : ""} />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-surface text-foreground flex flex-col">
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
            <div className="h-full flex flex-col">
              <div className="p-2 bg-surface-elevated text-xs text-muted-foreground">
                Live Preview (React + DOM)
              </div>

              {previewError && (
                <div className="p-3 m-3 border border-failure/45 bg-failure/12 text-failure rounded text-sm">
                  <h4 className="font-medium mb-1">Error rendering preview:</h4>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">{previewError}</pre>
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
    </div>
  );
};
