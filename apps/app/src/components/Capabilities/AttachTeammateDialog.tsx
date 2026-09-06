import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  LoadingRegion,
  SkeletonList,
} from "@ngriffin_uk/polychat-component-ui";
import type { TeammateResponse } from "@ngriffin_uk/polychat-schemas";
import { Bot, Plus } from "lucide-react";
import { useState } from "react";

interface AttachTeammateDialogProps {
  agents: TeammateResponse[];
  error?: Error | null;
  isLoading: boolean;
  onAttach: (teammateId: string) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingTeammateId?: string;
}

export function AttachTeammateDialog({
  agents,
  error,
  isLoading,
  onAttach,
  onOpenChange,
  open,
  pendingTeammateId,
}: AttachTeammateDialogProps) {
  const [attachingTeammateId, setAttachingTeammateId] = useState<string | null>(null);

  const attach = async (teammateId: string) => {
    setAttachingTeammateId(teammateId);

    try {
      await onAttach(teammateId);
      onOpenChange(false);
    } finally {
      setAttachingTeammateId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a teammate to this project</DialogTitle>
          <DialogDescription>
            Workspace teammates become available to every member once they are added.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        )}

        {isLoading ? (
          <LoadingRegion label="Loading teammates">
            <SkeletonList count={3} />
          </LoadingRegion>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={24} className="text-muted-foreground" />}
            title="No teammates left to add"
            message="Every workspace teammate is already on this project. Publish a teammate to the workspace to make it available here."
            className="min-h-[160px]"
          />
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{agent.description}</p>
                </div>
                <Button
                  variant="primary"
                  icon={<Plus size={15} />}
                  isLoading={attachingTeammateId === agent.id || pendingTeammateId === agent.id}
                  disabled={attachingTeammateId !== null}
                  onClick={() => void attach(agent.id)}
                >
                  Add to project
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
