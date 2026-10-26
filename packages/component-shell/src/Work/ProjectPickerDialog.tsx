import { StartConversationDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  getProjectBasePath,
  useTrackEvent,
  useWorkspace,
  useWorkspaces,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";

export function ProjectPickerDialog({
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
  const workspaces = workspacesQuery.data ?? [];
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  const error = workspacesQuery.error ?? workspaceQuery.error;

  return (
    <StartConversationDialog
      open={open}
      description="Pick a workspace, then a project. The task goes on that project's board."
      projectDescription="Pick the project this task belongs to."
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
        onOpenChange(false);
        setWorkspaceId(null);

        clearCurrentConversation();
        void navigate(`${getProjectBasePath(workspaceId, projectId)}?new=1`);
      }}
    />
  );
}
