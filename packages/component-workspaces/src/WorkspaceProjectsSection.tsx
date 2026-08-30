import { Button, EmptyState, TextLink } from "@ngriffin_uk/polychat-component-ui";
import { FolderKanban } from "lucide-react";

import { ProjectCardGrid, type ProjectCardItem } from "./WorkspaceCards";

export interface WorkspaceProjectsSectionProps {
  projects: ProjectCardItem[];
  memberCount: number;
  membersHref: string;
  canManage?: boolean;
  onCreateProject: () => void;
}

export function WorkspaceProjectsSection({
  projects,
  memberCount,
  membersHref,
  canManage = false,
  onCreateProject,
}: WorkspaceProjectsSectionProps) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-sm text-zinc-500">Projects in this workspace.</p>
        </div>
        <TextLink href={membersHref}>
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </TextLink>
      </div>
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={24} className="text-zinc-400" />}
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
