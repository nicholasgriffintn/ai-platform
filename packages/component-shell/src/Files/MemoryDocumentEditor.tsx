import { Button, Label, Textarea } from "@ngriffin_uk/polychat-component-ui";
import {
  getErrorMessage,
  useMemoryDocumentEditor,
  type SaveMemoryDocumentRevisionInput,
} from "@ngriffin_uk/polychat-library-react";
import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";

export function MemoryDocumentEditor({
  document,
  isLoading,
  label = "What this remembers",
  saveDocument,
  loadDocument,
  onSaved,
}: {
  document: MemoryDocument | undefined;
  isLoading: boolean;
  label?: string;
  saveDocument: (input: SaveMemoryDocumentRevisionInput) => Promise<MemoryDocument>;
  loadDocument: () => Promise<MemoryDocument>;
  onSaved?: () => void;
}) {
  const editor = useMemoryDocumentEditor({ document, saveDocument, loadDocument });

  return (
    <div className="space-y-2">
      <Label htmlFor={document ? `memory-${document.id}` : undefined}>{label}</Label>
      <Textarea
        id={document ? `memory-${document.id}` : undefined}
        rows={12}
        value={editor.draft}
        disabled={isLoading || !document}
        onChange={(event) => editor.edit(event.target.value)}
      />
      {editor.status === "conflict" && editor.incoming && (
        <div className="space-y-3 rounded-md border border-attention/40 bg-attention/5 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">This document changed elsewhere</p>
            <p className="text-xs text-muted-foreground">
              Compare revision {editor.incoming.revision} with your edits, then choose which version
              to continue from.
            </p>
          </div>
          <div className="rounded-md border border-border bg-background p-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Current saved version</p>
            <pre className="max-h-40 overflow-auto text-xs whitespace-pre-wrap text-foreground">
              {editor.incoming.content || "Empty"}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={editor.useServer}>
              Use saved version
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={editor.keepMyEdits}>
              Keep my edits
            </Button>
          </div>
        </div>
      )}
      {editor.error && (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(editor.error, "Unable to save this document")}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          isLoading={editor.status === "saving"}
          disabled={!editor.isDirty || editor.status === "conflict"}
          onClick={() => {
            void editor.save().then((saved) => {
              if (saved) {
                onSaved?.();
              }
            });
          }}
        >
          Save a revision
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!editor.isDirty || editor.status === "saving"}
          onClick={editor.discard}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}
