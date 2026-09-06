import {
  Button,
  CardGridLoadingSkeleton,
  EmptyState,
  FormInput,
  Label,
  Textarea,
} from "@ngriffin_uk/polychat-component-ui";
import { BookOpenText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useMemoryDocument, useMemoryDocuments } from "~/hooks/useMemoryDocuments";
import { getErrorMessage } from "~/lib/errors";

export function MemoryLibrary({ projectId }: { projectId?: string }) {
  const { documents, isLoading, error, create, update, remove } = useMemoryDocuments(projectId);
  const [openName, setOpenName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const openDocument = useMemoryDocument(openName ?? undefined, projectId);

  const save = async () => {
    if (!openDocument.data || draft === null) {
      return;
    }

    try {
      await update.mutateAsync({
        name: openDocument.data.name,
        input: {
          content: draft,
          expectedRevision: openDocument.data.revision,
          ...(projectId ? { projectId } : {}),
        },
      });
      await openDocument.refetch();
      setDraft(null);
      toast.success("Saved a new revision");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Unable to save this memory"));
    }
  };

  if (isLoading) {
    return <CardGridLoadingSkeleton label="Loading memory" />;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-failure">
        {error.message}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newName.trim()) {
            return;
          }

          create
            .mutateAsync({
              name: newName.trim(),
              content: "",
              ...(projectId ? { projectId } : {}),
            })
            .then(() => {
              setOpenName(newName.trim());
              setNewName("");
            })
            .catch((createError: unknown) => {
              toast.error(getErrorMessage(createError, "Unable to start this memory"));
            });
        }}
      >
        <div className="min-w-56 flex-1">
          <FormInput
            label="New memory"
            value={newName}
            placeholder="how-we-write"
            description="Lowercase words joined by hyphens, so it reads the same everywhere."
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          icon={<Plus size={15} />}
          isLoading={create.isPending}
          disabled={!newName.trim()}
        >
          Start it
        </Button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={<BookOpenText size={24} className="text-muted-foreground" />}
          title="Nothing remembered yet"
          message="Memories kept as documents show up here, and you can edit or delete any of them."
          className="min-h-[180px]"
        />
      ) : (
        <ul className="space-y-2">
          {documents.map((document) => {
            const isOpen = openName === document.name;

            return (
              <li key={document.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    aria-expanded={isOpen}
                    onClick={() => {
                      setDraft(null);
                      setOpenName(isOpen ? null : document.name);
                    }}
                  >
                    <span className="block truncate text-sm font-medium">{document.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {document.excerpt || "Empty"} · revision {document.revision}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${document.name}`}
                    className="text-muted-foreground hover:text-failure"
                    icon={<Trash2 size={15} />}
                    isLoading={remove.isPending && remove.variables === document.name}
                    onClick={() => {
                      remove.mutateAsync(document.name).catch((deleteError: unknown) => {
                        toast.error(getErrorMessage(deleteError, "Unable to delete this memory"));
                      });
                    }}
                  />
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`memory-${document.id}`}>What this remembers</Label>
                    <Textarea
                      id={`memory-${document.id}`}
                      rows={10}
                      value={draft ?? openDocument.data?.content ?? ""}
                      disabled={openDocument.isLoading}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={update.isPending}
                        disabled={draft === null}
                        onClick={() => void save()}
                      >
                        Save a revision
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={draft === null}
                        onClick={() => setDraft(null)}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
