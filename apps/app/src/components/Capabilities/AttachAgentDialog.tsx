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
import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { Bot, Plus } from "lucide-react";
import { useState } from "react";

interface AttachAgentDialogProps {
  agents: AgentResponse[];
  error?: Error | null;
  isLoading: boolean;
  onAttach: (agentId: string) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingAgentId?: string;
}

export function AttachAgentDialog({
  agents,
  error,
  isLoading,
  onAttach,
  onOpenChange,
  open,
  pendingAgentId,
}: AttachAgentDialogProps) {
  const [attachingAgentId, setAttachingAgentId] = useState<string | null>(null);

  const attach = async (agentId: string) => {
    setAttachingAgentId(agentId);

    try {
      await onAttach(agentId);
      onOpenChange(false);
    } finally {
      setAttachingAgentId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an agent to this project</DialogTitle>
          <DialogDescription>
            Workspace agents become available to every member once they are added.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p role="alert" className="text-sm text-failure">
            {error.message}
          </p>
        )}

        {isLoading ? (
          <LoadingRegion label="Loading agents">
            <SkeletonList count={3} />
          </LoadingRegion>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={<Bot size={24} className="text-muted-foreground" />}
            title="No agents left to add"
            message="Every workspace agent is already on this project. Publish an agent to the workspace to make it available here."
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
                  isLoading={attachingAgentId === agent.id || pendingAgentId === agent.id}
                  disabled={attachingAgentId !== null}
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
