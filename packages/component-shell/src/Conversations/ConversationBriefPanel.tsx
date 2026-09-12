import { Button } from "@ngriffin_uk/polychat-component-ui";
import { getErrorMessage, useConversationBrief } from "@ngriffin_uk/polychat-library-react";
import { NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { MemoryDocumentEditor } from "../Files/MemoryDocumentEditor.js";

export function ConversationBriefPanel({ conversationId }: { conversationId: string }) {
  const brief = useConversationBrief(conversationId);
  const document = brief.data?.document ?? undefined;

  if (brief.isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading brief…</p>;
  }

  if (brief.error) {
    return (
      <p role="alert" className="p-4 text-sm text-failure">
        {getErrorMessage(brief.error, "Unable to load this conversation brief")}
      </p>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <NotebookPen size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Conversation context</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The agent keeps this brief for continuity. Edit it only when something needs correction.
        </p>
      </div>
      {document ? (
        <MemoryDocumentEditor
          document={document}
          isLoading={brief.isFetching}
          label="Working context"
          saveDocument={(input) => brief.update.mutateAsync(input)}
          loadDocument={async () => {
            const result = await brief.refetch();
            const current = result.data?.document;

            if (!current) {
              throw result.error ?? new Error("Unable to reload this conversation brief");
            }

            return current;
          }}
          onSaved={() => toast.success("Saved the conversation brief")}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No brief is needed yet. One is created when this conversation needs continuity across
            turns, routines or teammates.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            isLoading={brief.ensure.isPending}
            onClick={() => {
              void brief.ensure.mutateAsync().catch((error: unknown) => {
                toast.error(getErrorMessage(error, "Unable to start this conversation brief"));
              });
            }}
          >
            Create one now
          </Button>
        </div>
      )}
    </div>
  );
}
