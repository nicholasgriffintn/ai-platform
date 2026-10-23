import { Button, CardGridLoadingSkeleton, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import {
  getFilesPath,
  useMemoryDocument,
  useUpdateMemoryDocument,
} from "@ngriffin_uk/polychat-library-react";
import { formatRelativeTime } from "@ngriffin_uk/polychat-utility-core";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { FilesBreadcrumb } from "./FilesBreadcrumb.js";
import { memoryToFileItem } from "./Library/file-items.js";
import { FileActionDialogs } from "./Library/FileActionDialogs.js";
import { useFileActions } from "./Library/useFileActions.js";
import { MemoryDocumentEditor } from "./MemoryDocumentEditor.js";

export function MemoryDocumentDetail({
  basePath,
  projectId,
  name,
}: {
  basePath: string;
  projectId?: string;
  name: string;
}) {
  const navigate = useNavigate();
  const document = useMemoryDocument(name, projectId);
  const update = useUpdateMemoryDocument(projectId);
  const memoryPath = getFilesPath(basePath, "memory");
  const actions = useFileActions({ projectId, onDeleted: () => void navigate(memoryPath) });
  const trail = [{ label: "Memory", href: memoryPath }, { label: name }];

  if (document.isLoading) {
    return <CardGridLoadingSkeleton count={1} label="Loading memory" />;
  }

  if (document.error || !document.data) {
    return (
      <div className="space-y-4">
        <FilesBreadcrumb basePath={basePath} trail={trail} />
        <EmptyState
          title="Memory unavailable"
          message={document.error?.message ?? "It may have been forgotten."}
        />
      </div>
    );
  }

  const item = memoryToFileItem({ ...document.data, excerpt: "" }, basePath);

  return (
    <div className="space-y-6">
      <FilesBreadcrumb
        basePath={basePath}
        trail={trail}
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={15} />}
            className="text-muted-foreground hover:text-failure"
            onClick={() => actions.request("delete", item)}
          >
            Forget
          </Button>
        }
      />
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{name}</h2>
        <p className="text-sm text-muted-foreground">
          Revision {document.data.revision} · updated {formatRelativeTime(document.data.updatedAt)}
        </p>
      </div>
      <MemoryDocumentEditor
        document={document.data}
        isLoading={false}
        saveDocument={(input) =>
          update.mutateAsync({ name, input: { ...input, ...(projectId ? { projectId } : {}) } })
        }
        loadDocument={async () => {
          const result = await document.refetch();

          if (!result.data) {
            throw result.error ?? new Error("Unable to reload this memory document");
          }

          return result.data;
        }}
        onSaved={() => toast.success("Saved a new revision")}
      />
      <FileActionDialogs actions={actions} />
    </div>
  );
}
