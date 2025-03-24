import { Code2, Copy, FileText, Play, X } from "lucide-react";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { MemoizedMarkdown } from "~/components/ui/Markdown";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import type { ArtifactProps } from "~/types/artifact";

const ArtifactSandbox = lazy(() =>
  import("./ArtifactSandbox/index").then((mod) => ({
    default: mod.ArtifactSandbox,
  })),
);

const SandboxLoading = () => (
  <div className="flex items-center justify-center h-full w-full bg-white dark:bg-zinc-800 p-4 text-sm text-zinc-500 dark:text-zinc-400">
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
    <div className="file-tabs overflow-x-auto whitespace-nowrap px-1 border-b border-zinc-200 dark:border-zinc-700 flex">
      {artifacts.map((artifact, index) => (
        <button
          key={artifact.identifier || index}
          type="button"
          className={`py-2 px-3 text-xs inline-block ${
            activeIndex === index
              ? "border-b-2 border-blue-500 font-medium text-blue-600 dark:text-blue-400"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300"
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
      <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400 flex justify-between items-center">
        <div>
          {artifact.language && (
            <span className="mr-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-700 dark:text-zinc-300">
              {artifact.language}
            </span>
          )}
          <span className="font-medium">
            {artifact.title || artifact.identifier}
          </span>
        </div>
        {showCopyButton && (
          <button
            type="button"
            onClick={onCopy}
            className="p-1.5 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            title={copied ? "Copied!" : "Copy file"}
            aria-label={copied ? "Copied to clipboard" : "Copy file"}
          >
            <Copy size={14} className={copied ? "text-green-500" : ""} />
          </button>
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

interface ArtifactPanelProps {
  artifact: ArtifactProps | null;
  artifacts?: ArtifactProps[];
  onClose: () => void;
  isVisible: boolean;
  isCombined?: boolean;
}

export const ArtifactPanel = ({
  artifact,
  artifacts = [],
  onClose,
  isVisible,
  isCombined = false,
}: ArtifactPanelProps) => {
  const { copied, copy } = useCopyToClipboard();
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
    () =>
      allArtifacts.find((a) => {
        const includedLanguages = ["jsx", "javascript", "html", "svg"];
        const includedTypes = [
          "text/jsx",
          "text/javascript",
          "text/html",
          "image/svg+xml",
        ];

        return (
          includedLanguages.some((lang) =>
            a.language?.toLowerCase().includes(lang),
          ) || includedTypes.some((type) => a.type?.includes(type))
        );
      }),
    [allArtifacts],
  );

  const cssArtifact = useMemo(
    () => allArtifacts.find((a) => a.language?.toLowerCase().includes("css")),
    [allArtifacts],
  );

  const showPreviewTab = useMemo(
    () => codeArtifact !== undefined,
    [codeArtifact],
  );

  const currentArtifact = useMemo(() => {
    return allArtifacts[activeFileIndex] || allArtifacts[0];
  }, [allArtifacts, activeFileIndex]);

  const showFileTabs = useMemo(
    () => allArtifacts.length > 1,
    [allArtifacts.length],
  );

  const isCode = useMemo(() => {
    if (!artifact) {
      return false;
    }

    const includedLanguages = ["jsx", "javascript", "html", "svg"];
    const includedTypes = [
      "text/jsx",
      "text/javascript",
      "text/html",
      "image/svg+xml",
    ];

    return (
      includedLanguages.some((lang) =>
        artifact.language?.toLowerCase().includes(lang),
      ) || includedTypes.some((type) => artifact.type?.includes(type))
    );
  }, [artifact]);
  const icon = useMemo(
    () => (isCode ? <Code2 size={20} /> : <FileText size={20} />),
    [isCode],
  );

  useEffect(() => {
    setActiveFileIndex(0);
  }, []);

  useEffect(() => {
    if (activeTab === "preview") {
      setPreviewError(null);
      setIframeKey((prev) => prev + 1);
    }
  }, [activeTab]);

  const handleCopyCurrentFile = useCallback(() => {
    if (currentArtifact) {
      copy(currentArtifact.content);
    }
  }, [currentArtifact, copy]);

  const handleCopyAllFiles = useCallback(() => {
    const combinedContent = allArtifacts
      .map(
        (a) =>
          `// ${a.title || a.identifier} (${a.language || "unknown language"})\n${a.content}`,
      )
      .join("\n\n");

    copy(combinedContent);
  }, [allArtifacts, copy]);

  const handleTabSelect = useCallback((index: number) => {
    setActiveFileIndex(index);
  }, []);

  const handleSetActiveTab = useCallback((tab: "code" | "preview") => {
    setActiveTab(tab);
  }, []);

  if (allArtifacts.length === 0) return null;

  return (
    <div
      className={`
        absolute right-0 top-0 h-full 
        w-[90%] sm:w-[350px] md:w-[400px] lg:w-[650px] 
        bg-white dark:bg-zinc-800 
        border-l border-zinc-200 dark:border-zinc-700 
        shadow-xl z-50 
        transition-transform duration-300 ease-in-out 
        ${isVisible ? "translate-x-0" : "translate-x-full"}
      `}
      aria-labelledby="artifact-panel-title"
      aria-modal="true"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 min-w-0 flex-1 overflow-hidden">
            {icon}
            <h3
              id="artifact-panel-title"
              className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 truncate"
            >
              {allArtifacts.length > 1
                ? `Combined Artifacts (${allArtifacts.length})`
                : currentArtifact.title || "Artifact"}
            </h3>
          </div>
          <div className="flex gap-2 flex-shrink-0 ml-2">
            {!showFileTabs && (
              <button
                type="button"
                onClick={handleCopyCurrentFile}
                className="p-2 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title={copied ? "Copied!" : "Copy content"}
                aria-label={
                  copied ? "Copied to clipboard" : "Copy to clipboard"
                }
              >
                <Copy size={16} className={copied ? "text-green-500" : ""} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Close panel"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {showPreviewTab && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === "code"
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-zinc-600 dark:text-zinc-400"
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
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-zinc-600 dark:text-zinc-400"
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
                <button
                  type="button"
                  onClick={handleCopyAllFiles}
                  className="p-2 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  title={copied ? "Copied!" : "Copy all files"}
                  aria-label={copied ? "Copied to clipboard" : "Copy all files"}
                >
                  <Copy size={16} className={copied ? "text-green-500" : ""} />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex flex-col">
          {(activeTab === "code" || !showPreviewTab) && (
            <>
              {showFileTabs && (
                <FileTabs
                  artifacts={allArtifacts}
                  activeIndex={activeFileIndex}
                  onSelectTab={handleTabSelect}
                />
              )}

              <ContentViewer
                artifact={currentArtifact}
                showCopyButton={showFileTabs}
                onCopy={handleCopyCurrentFile}
                copied={copied}
              />
            </>
          )}

          {activeTab === "preview" && codeArtifact && (
            <div className="h-full flex flex-col">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
                Live Preview (React + DOM)
              </div>

              {previewError && (
                <div className="p-3 m-3 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-800 dark:text-red-300 rounded text-sm">
                  <h4 className="font-medium mb-1">Error rendering preview:</h4>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">
                    {previewError}
                  </pre>
                </div>
              )}

              <div className="flex-1 bg-white">
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
