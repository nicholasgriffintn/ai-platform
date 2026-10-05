import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useTeammateContextMemory } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { MemoryDocumentEditor } from "../Files/MemoryDocumentEditor.js";

export function TeammateMemoryPanel({ contextId }: { contextId: string }) {
  const memory = useTeammateContextMemory(contextId);
  const maintenanceStatus = memory.maintenance.data?.status;
  const maintenancePending =
    memory.maintain.isPending || maintenanceStatus === "queued" || maintenanceStatus === "running";

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
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          With memory saving enabled, this teammate keeps its notes current from your messages. Tidy
          memory reconciles earlier corrections using your configured AI model. It may use credits.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={maintenancePending || !memory.data}
          onClick={() => memory.maintain.mutate()}
        >
          {maintenancePending ? "Tidying memory…" : "Tidy memory"}
        </Button>
        {maintenanceStatus === "completed" && (
          <p className="text-xs text-muted-foreground">Memory is current.</p>
        )}
        {(memory.maintain.error || memory.maintenance.error || memory.maintenance.data?.error) && (
          <p className="text-sm text-destructive">
            {getErrorMessage(
              memory.maintain.error || memory.maintenance.error || memory.maintenance.data?.error,
              "Could not tidy memory.",
            )}
          </p>
        )}
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
