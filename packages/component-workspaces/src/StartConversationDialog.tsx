import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { ChevronLeft, ChevronRight, FolderKanban, Loader2 } from "lucide-react";

export interface StartConversationWorkspaceOption {
  id: string;
  name: string;
  projectCount: number;
}

export interface StartConversationProjectOption {
  id: string;
  name: string;
  colour?: string;
  description?: string;
}

export interface StartConversationDialogProps {
  open: boolean;
  workspaces: StartConversationWorkspaceOption[];
  isLoadingWorkspaces?: boolean;
  selectedWorkspace?: StartConversationWorkspaceOption | null;
  projects: StartConversationProjectOption[];
  isLoadingProjects?: boolean;
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onSelectProject: (projectId: string) => void;
}

const rowClassName =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-selection focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StartConversationDialog({
  open,
  workspaces,
  isLoadingWorkspaces = false,
  selectedWorkspace,
  projects,
  isLoadingProjects = false,
  errorMessage,
  onOpenChange,
  onSelectWorkspace,
  onSelectProject,
}: StartConversationDialogProps) {
  const choosingProject = Boolean(selectedWorkspace);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {choosingProject ? `Start in ${selectedWorkspace?.name}` : "Where should this go?"}
          </DialogTitle>
          <DialogDescription>
            {choosingProject
              ? "Pick the project this conversation belongs to."
              : "Pick a workspace, then a project. The conversation uses that project's brief and teammates."}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <p role="alert" className="text-failure text-sm">
            {errorMessage}
          </p>
        ) : null}

        {choosingProject ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<ChevronLeft size={16} />}
              onClick={() => onSelectWorkspace(null)}
            >
              All workspaces
            </Button>
            {isLoadingProjects ? (
              <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading projects…
              </div>
            ) : projects.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                This workspace has no projects yet. Create one from the workspace page first.
              </p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      className={rowClassName}
                      onClick={() => onSelectProject(project.id)}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.colour }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{project.name}</span>
                        {project.description ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {project.description}
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : isLoadingWorkspaces ? (
          <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading workspaces…
          </div>
        ) : workspaces.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-sm">
            You are not a member of any workspace yet.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  className={cn(rowClassName)}
                  onClick={() => onSelectWorkspace(workspace.id)}
                >
                  <FolderKanban size={16} className="text-muted-foreground shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {workspace.projectCount === 1
                      ? "1 project"
                      : `${workspace.projectCount} projects`}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
