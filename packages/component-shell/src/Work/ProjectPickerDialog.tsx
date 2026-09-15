import { StartConversationDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  getProjectCanvasPath,
  getProjectChatPath,
  useTrackEvent,
  useWorkspace,
  useWorkspaces,
  type ProjectPickerDestination,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";
import { useNavigate } from "react-router";

const CANVAS_COPY = {
  description: "Pick a workspace, then a project. Anything you make is kept with that project.",
  projectDescription: "Pick the project this canvas belongs to.",
};

export function ProjectPickerDialog({
  destination,
  open,
  onOpenChange,
}: {
  destination: ProjectPickerDestination;
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
  const isCanvas = destination === "canvas";

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
      description={isCanvas ? CANVAS_COPY.description : undefined}
      projectDescription={isCanvas ? CANVAS_COPY.projectDescription : undefined}
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
          name: isCanvas ? "open_canvas" : "new_chat",
          category: "sidebar",
          label: "project_picker",
          value: 1,
        });
        onOpenChange(false);
        setWorkspaceId(null);

        if (isCanvas) {
          void navigate(getProjectCanvasPath(workspaceId, projectId));

          return;
        }

        clearCurrentConversation();
        void navigate(getProjectChatPath(workspaceId, projectId));
      }}
    />
  );
}
