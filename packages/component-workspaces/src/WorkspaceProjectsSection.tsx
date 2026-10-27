import { Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { FolderKanban } from "lucide-react";

import { ProjectCardGrid, type ProjectCardItem } from "./WorkspaceCards";

export interface WorkspaceProjectsSectionProps {
  projects: ProjectCardItem[];
  canManage?: boolean;
  onCreateProject: () => void;
}

export function WorkspaceProjectsSection({
  projects,
  canManage = false,
  onCreateProject,
}: WorkspaceProjectsSectionProps) {
  return (
    <>
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={24} className="text-muted-foreground" />}
          title="No projects yet"
          message="Create a project to keep its conversations, instructions, and capabilities together."
          action={canManage ? <Button onClick={onCreateProject}>Create project</Button> : undefined}
          className="min-h-[260px]"
        />
      ) : (
        <ProjectCardGrid projects={projects} />
      )}
    </>
  );
}
