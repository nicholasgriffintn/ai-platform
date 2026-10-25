import { MemoizedMarkdown, ViewerStatus } from "@ngriffin_uk/polychat-component-content";
import { EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  useMemoryDocument,
  useMemoryDocumentRevisions,
  useUpdateMemoryDocument,
} from "@ngriffin_uk/polychat-library-react";
import type { MemoryDocumentType } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { History, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { memoryToFileItem } from "../Library/file-items.js";
import { useFileActions } from "../Library/useFileActions.js";
import { MemoryDocumentEditor } from "../MemoryDocumentEditor.js";
import { EditToggleButton } from "./EditToggleButton.js";
import { FileViewerCloseButton } from "./FileViewerCloseButton.js";
import { type FileViewerChrome, FileViewerFrame } from "./FileViewerFrame.js";
import { MarkdownStage } from "./MarkdownStage.js";
import { useFileViewerPanels } from "./useFileViewerPanels.js";

const MEMORY_TYPE_LABELS: Record<MemoryDocumentType, string> = {
  user: "About you",
  feedback: "How to work with you",
  project: "Ongoing work",
  reference: "Where to find things",
};

function MemoryHistory({ name, projectId }: { name: string; projectId?: string }) {
  const revisions = useMemoryDocumentRevisions(name, projectId);

  if (revisions.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading version history…</p>;
  }

  if (revisions.error) {
    return (
      <p role="alert" className="text-sm text-failure">
        Version history is unavailable.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {(revisions.data ?? []).map((revision) => (
        <li key={revision.id}>
          <details className="group rounded-lg border border-border">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-foreground">
                Revision {revision.revision}
                {revision.changeNote ? (
                  <span className="text-muted-foreground"> · {revision.changeNote}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(revision.createdAt)}
              </span>
            </summary>
            <div className="prose prose-sm max-w-none border-t border-border px-3 py-2 dark:prose-invert">
              <MemoizedMarkdown>{revision.content}</MemoizedMarkdown>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

export function MemoryViewer({
  basePath,
  projectId,
  name,
  chrome,
  onDeleted,
}: {
  basePath: string;
  projectId?: string;
  name: string;
  chrome: FileViewerChrome;
  onDeleted: () => void;
}) {
  const panels = useFileViewerPanels();
  const [isEditing, setIsEditing] = useState(false);
  const document = useMemoryDocument(name, projectId);
  const update = useUpdateMemoryDocument(projectId);
  const actions = useFileActions({ projectId, onDeleted });

  if (document.isLoading) {
    return (
      <ViewerStatus
        label="Loading memory"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      />
    );
  }

  if (document.error || !document.data) {
    return (
      <ViewerStatus
        label="Memory unavailable"
        actions={<FileViewerCloseButton onClose={chrome.onClose} />}
      >
        <EmptyState
          variant="inset"
          title="Memory unavailable"
          message={document.error?.message ?? "It may have been forgotten."}
          className="h-full"
        />
      </ViewerStatus>
    );
  }

  const memory = document.data;

  return (
    <FileViewerFrame
      item={memoryToFileItem({ ...memory, excerpt: memory.description }, basePath)}
      subject={{ type: "memory", id: memory.id }}
      location="Files · Memory"
      projectId={projectId}
      panels={panels}
      actions={actions}
      chrome={chrome}
      headerActions={
        <EditToggleButton
          isEditing={isEditing}
          onToggle={() => setIsEditing((editing) => !editing)}
        />
      }
      stage={
        isEditing ? (
          <div className="mx-auto w-full max-w-3xl px-6 py-8">
            <MemoryDocumentEditor
              document={memory}
              isLoading={false}
              saveDocument={(input) =>
                update.mutateAsync({
                  name,
                  input: { ...input, ...(projectId ? { projectId } : {}) },
                })
              }
              loadDocument={async () => {
                const result = await document.refetch();

                if (!result.data) {
                  throw result.error ?? new Error("Unable to reload this memory document");
                }

                return result.data;
              }}
              onSaved={() => {
                toast.success("Saved a new revision");
                setIsEditing(false);
              }}
            />
          </div>
        ) : (
          <MarkdownStage markdown={memory.content || "_Nothing remembered here yet._"} />
        )
      }
      drawers={[
        {
          key: "info",
          label: "File info",
          icon: <Info size={14} aria-hidden="true" />,
          content: (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {memory.description ? (
                <>
                  <dt className="text-muted-foreground">About</dt>
                  <dd className="text-foreground">{memory.description}</dd>
                </>
              ) : null}
              {memory.type ? (
                <>
                  <dt className="text-muted-foreground">Kind</dt>
                  <dd className="text-foreground">{MEMORY_TYPE_LABELS[memory.type]}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="text-foreground">{formatRelativeTime(memory.updatedAt)}</dd>
              <dt className="text-muted-foreground">Kept for</dt>
              <dd className="text-foreground">
                {memory.scopeType === "project" ? "This project" : "You"}
              </dd>
            </dl>
          ),
        },
        {
          key: "history",
          label: "Version history",
          detail: String(memory.revision),
          icon: <History size={14} aria-hidden="true" />,
          content: <MemoryHistory name={name} projectId={projectId} />,
        },
      ]}
    />
  );
}
