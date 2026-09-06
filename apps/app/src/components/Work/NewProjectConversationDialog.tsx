import { StartConversationDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useWorkspace, useWorkspaces } from "~/hooks/useWorkspaces";
import { getProjectChatPath } from "~/lib/conversation-route";
import { getErrorMessage } from "~/lib/errors";
import { useChatStore } from "~/state/stores/chatStore";

export function NewProjectConversationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { trackEvent } = useTrackEvent();
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const workspacesQuery = useWorkspaces();
  const workspaceQuery = useWorkspace(workspaceId ?? undefined);
  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  const error = workspacesQuery.error ?? workspaceQuery.error;

  return (
    <StartConversationDialog
      open={open}
      workspaces={workspaces.map(({ id, name, projectCount }) => ({ id, name, projectCount }))}
      isLoadingWorkspaces={workspacesQuery.isLoading}
      selectedWorkspace={selectedWorkspace}
      projects={(workspaceQuery.data?.projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        colour: project.colour,
        description: project.description,
      }))}
      isLoadingProjects={Boolean(workspaceId) && workspaceQuery.isLoading}
      errorMessage={error ? getErrorMessage(error, "Workspaces could not be loaded") : undefined}
      onOpenChange={(next) => {
        if (!next) {
          setWorkspaceId(null);
        }

        onOpenChange(next);
      }}
      onSelectWorkspace={setWorkspaceId}
      onSelectProject={(projectId) => {
        if (!workspaceId) {
          return;
        }

        trackEvent({
          name: "new_chat",
          category: "sidebar",
          label: "project_picker",
          value: 1,
        });
        clearCurrentConversation();
        onOpenChange(false);
        setWorkspaceId(null);
        void navigate(getProjectChatPath(workspaceId, projectId));
      }}
    />
  );
}
