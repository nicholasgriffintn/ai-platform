import { Card, Link } from "@ngriffin_uk/polychat-component-ui";
import { ArrowRight, BriefcaseBusiness, FolderKanban, Users } from "lucide-react";

import type { WorkspaceRole } from "./WorkspaceMemberList";

export interface WorkspaceCardItem {
  id: string;
  name: string;
  role: WorkspaceRole;
  description?: string | null;
  projectCount: number;
  memberCount: number;
  href: string;
}

export function WorkspaceCardGrid({ workspaces }: { workspaces: WorkspaceCardItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {workspaces.map((workspace) => (
        <Link
          key={workspace.id}
          href={workspace.href}
          className="group no-underline hover:!no-underline"
        >
          <Card className="h-full p-6 transition-colors group-hover:border-border-strong">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs capitalize text-muted-foreground">{workspace.role}</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground group-hover:underline">
                  {workspace.name}
                </h2>
              </div>
              <BriefcaseBusiness size={18} className="text-muted-foreground" />
            </div>
            <p className="min-h-10 text-sm leading-5 text-muted-foreground">
              {workspace.description || "No description"}
            </p>
            <div className="flex gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>{workspace.projectCount} projects</span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {workspace.memberCount}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export interface ProjectCardItem {
  id: string;
  name: string;
  description?: string | null;
  conversationCount: number;
  capabilityCount: number;
  href: string;
}

export function ProjectCardGrid({ projects }: { projects: ProjectCardItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={project.href}
          className="group no-underline hover:!no-underline"
        >
          <Card className="h-full p-6 transition-colors group-hover:border-border-strong">
            <div className="flex items-start justify-between">
              <FolderKanban size={20} className="text-muted-foreground" />
              <ArrowRight size={18} className="text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-foreground group-hover:underline">
              {project.name}
            </h3>
            <p className="min-h-12 text-sm leading-6 text-muted-foreground">
              {project.description || "No description"}
            </p>
            <div className="flex gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                {project.conversationCount} conversation
                {project.conversationCount !== 1 ? "s" : ""}
              </span>
              <span>
                {project.capabilityCount} capabilit
                {project.capabilityCount !== 1 ? "es" : "y"}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
