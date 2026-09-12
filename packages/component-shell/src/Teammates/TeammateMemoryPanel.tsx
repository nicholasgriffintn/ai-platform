import { getErrorMessage, useTeammateContextMemory } from "@ngriffin_uk/polychat-library-react";

import { MemoryDocumentEditor } from "../Files/MemoryDocumentEditor.js";

export function TeammateMemoryPanel({ contextId }: { contextId: string }) {
  const memory = useTeammateContextMemory(contextId);

  if (memory.error) {
    return (
      <p className="text-sm text-destructive">
        {getErrorMessage(memory.error, "Could not load this teammate’s memory.")}
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Memory</h3>
        <p className="text-xs text-muted-foreground">
          Private notes this teammate carries between conversations, routines and delegated work.
        </p>
      </div>
      <MemoryDocumentEditor
        document={memory.data}
        isLoading={memory.isLoading}
        label="What this teammate remembers"
        saveDocument={(input) => memory.update.mutateAsync(input)}
        loadDocument={async () => {
          const result = await memory.refetch();

          if (!result.data) {
            throw new Error("Teammate memory is unavailable");
          }

          return result.data;
        }}
      />
    </div>
  );
}
