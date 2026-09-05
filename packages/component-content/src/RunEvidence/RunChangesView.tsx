import { Badge, Button, EmptyState, SearchInput } from "@ngriffin_uk/polychat-component-ui";
import { ChevronLeft, ChevronRight, FileDiff, FileWarning } from "lucide-react";
import { useMemo, useState } from "react";

import { Markdown } from "../markdown";
import {
  groupDiffHunkLines,
  parseUnifiedDiff,
  type DiffFile,
  type DiffFileStatus,
} from "./parseUnifiedDiff";

export interface RunEvidenceContent {
  text: string;
  contentType: string;
  truncated: boolean;
  binary: boolean;
}

export interface RunChangesViewProps {
  content?: RunEvidenceContent;
  recordedFiles?: string[];
  isLoading?: boolean;
  errorMessage?: string;
}

const STATUS_LABELS: Record<DiffFileStatus, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
};
const EMPTY_RECORDED_FILES: string[] = [];

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function directory(path: string): string | undefined {
  const parts = path.split("/");

  return parts.length > 1 ? parts.slice(0, -1).join("/") : undefined;
}

function DiffFileButton({
  file,
  selected,
  onSelect,
}: {
  file: DiffFile;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={`focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 ${
        selected ? "bg-selection text-foreground" : "hover:bg-selection/60"
      }`}
    >
      <FileDiff className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{fileName(file.path)}</span>
        {directory(file.path) ? (
          <span className="text-muted-foreground block truncate text-xs">
            {directory(file.path)}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-xs">
        <span className="text-success">+{file.additions}</span>{" "}
        <span className="text-failure">−{file.deletions}</span>
      </span>
      <span className="sr-only">{STATUS_LABELS[file.status]}</span>
    </button>
  );
}

function SelectedDiff({ file }: { file: DiffFile }) {
  if (file.binary) {
    return (
      <EmptyState
        icon={<FileWarning className="text-muted-foreground size-5" />}
        title="Binary change"
        message="This file cannot be rendered as text. Its change status remains available."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (file.hunks.length === 0) {
    return (
      <EmptyState
        icon={<FileDiff className="text-muted-foreground size-5" />}
        title="No text hunks available"
        message="The file metadata was recorded, but this diff contains no reviewable text."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="space-y-3">
      {file.hunks.map((hunk) => (
        <section
          key={`${hunk.header}-${hunk.lines[0] ?? "empty"}-${hunk.lines.length}`}
          className="border-border bg-canvas overflow-hidden rounded-lg border"
        >
          <h4 className="bg-surface-elevated text-muted-foreground px-3 py-2 font-mono text-xs">
            {hunk.header}
          </h4>
          {groupDiffHunkLines(hunk.lines).map((group) =>
            group.kind === "context" ? (
              <details key={`context-${group.startIndex}`} open className="border-border border-t">
                <summary className="text-muted-foreground focus-visible:ring-ring cursor-pointer px-3 py-2 text-xs outline-none focus-visible:ring-2">
                  {group.lines.length} unchanged {group.lines.length === 1 ? "line" : "lines"}
                </summary>
                <Markdown className="max-w-none text-xs">
                  {`\`\`\`diff\n${group.lines.join("\n")}\n\`\`\``}
                </Markdown>
              </details>
            ) : (
              <Markdown
                key={`change-${group.startIndex}`}
                className="border-border max-w-none border-t text-xs"
              >
                {`\`\`\`diff\n${group.lines.join("\n")}\n\`\`\``}
              </Markdown>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

export function RunChangesView({
  content,
  recordedFiles = EMPTY_RECORDED_FILES,
  isLoading = false,
  errorMessage,
}: RunChangesViewProps) {
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>();
  const files = useMemo(() => parseUnifiedDiff(content?.text ?? ""), [content?.text]);
  const filteredFiles = useMemo(() => {
    const normalised = query.trim().toLowerCase();

    return normalised
      ? files.filter((file) => file.path.toLowerCase().includes(normalised))
      : files;
  }, [files, query]);
  const selectedFile = filteredFiles.find((file) => file.path === selectedPath) ?? filteredFiles[0];
  const selectedIndex = selectedFile
    ? filteredFiles.findIndex((file) => file.path === selectedFile.path)
    : -1;

  if (errorMessage) {
    return (
      <EmptyState
        icon={<FileWarning className="text-failure size-5" />}
        title="Changes unavailable"
        message={errorMessage}
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (isLoading) {
    return (
      <EmptyState
        icon={<FileDiff className="text-muted-foreground size-5" />}
        title="Loading changes"
        message="Fetching the authorised diff…"
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (!content?.text.trim()) {
    if (recordedFiles.length > 0) {
      return (
        <div className="space-y-3">
          <EmptyState
            icon={<FileWarning className="text-muted-foreground size-5" />}
            title="Diff unavailable"
            message="The run recorded changed files, but its reviewable diff is unavailable."
            className="min-h-40 border-0 bg-transparent"
          />
          <ul aria-label="Recorded changed files" className="space-y-1">
            {recordedFiles.map((path) => (
              <li key={path} className="bg-surface-elevated rounded-md px-3 py-2 font-mono text-xs">
                {path}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <EmptyState
        icon={<FileDiff className="text-muted-foreground size-5" />}
        title="No changes recorded"
        message="A reviewable change set will appear when the run records a diff."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  if (content.binary) {
    return (
      <EmptyState
        icon={<FileWarning className="text-muted-foreground size-5" />}
        title="Diff is not text"
        message="This evidence cannot be rendered safely as a unified diff."
        className="min-h-52 border-0 bg-transparent"
      />
    );
  }

  return (
    <div className="space-y-3">
      {content.truncated ? (
        <output className="bg-attention/10 text-attention block rounded-lg px-3 py-2 text-sm">
          This diff is too large to render in full. Showing a bounded preview.
        </output>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Find changed file"
          aria-label="Find changed file"
          className="min-w-48 flex-1"
        />
        <Badge variant="outline">{files.length} files</Badge>
        <Button
          type="button"
          variant="icon"
          size="sm"
          aria-label="Previous changed file"
          disabled={selectedIndex <= 0}
          onClick={() => setSelectedPath(filteredFiles[selectedIndex - 1]?.path)}
          icon={<ChevronLeft className="size-4" />}
        />
        <Button
          type="button"
          variant="icon"
          size="sm"
          aria-label="Next changed file"
          disabled={selectedIndex < 0 || selectedIndex >= filteredFiles.length - 1}
          onClick={() => setSelectedPath(filteredFiles[selectedIndex + 1]?.path)}
          icon={<ChevronRight className="size-4" />}
        />
      </div>

      {filteredFiles.length === 0 ? (
        <EmptyState
          icon={<FileDiff className="text-muted-foreground size-5" />}
          title="No matching files"
          message="Try a different file name or directory."
          className="min-h-40 border-0 bg-transparent"
        />
      ) : (
        <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(12rem,0.34fr)_minmax(0,1fr)]">
          <nav
            aria-label="Changed files"
            className="border-border max-h-80 overflow-auto border-r pr-2"
          >
            <p className="text-muted-foreground px-2 pb-1 text-xs">
              Contracts and configuration first, tests last
            </p>
            {filteredFiles.map((file) => (
              <DiffFileButton
                key={`${file.oldPath ?? ""}-${file.path}`}
                file={file}
                selected={file.path === selectedFile?.path}
                onSelect={() => setSelectedPath(file.path)}
              />
            ))}
          </nav>

          {selectedFile ? (
            <section aria-label={`Changes in ${selectedFile.path}`} className="min-w-0">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-mono text-sm">{selectedFile.path}</h3>
                <Badge variant="outline">{STATUS_LABELS[selectedFile.status]}</Badge>
                <span className="font-mono text-xs">
                  <span className="text-success">+{selectedFile.additions}</span>{" "}
                  <span className="text-failure">−{selectedFile.deletions}</span>
                </span>
              </header>
              <SelectedDiff file={selectedFile} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
