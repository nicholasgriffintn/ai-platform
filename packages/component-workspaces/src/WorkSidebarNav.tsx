import { SidebarNavButton, sidebarNavLinkClass } from "@ngriffin_uk/polychat-component-navigation";
import { Badge, cn, Link, NavLink } from "@ngriffin_uk/polychat-component-ui";
import {
  Activity,
  ChevronRight,
  ClipboardList,
  Database,
  FolderKanban,
  Grid2X2,
  LayoutDashboard,
  ListChecks,
  PanelsTopLeft,
  Search,
  Settings2,
  SquarePen,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import type { WorkspaceRole } from "./WorkspaceMemberList";

export interface WorkSidebarProjectLink {
  id: string;
  name: string;
  colour?: string;
  href: string;
}

export interface WorkSidebarWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  projectsHref: string;
  membersHref: string;
  governanceHref: string;
  projects: WorkSidebarProjectLink[];
}

export interface WorkSidebarProject {
  newConversationHref: string;
  experiencesHref: string;
  outputsHref: string;
  sourcesHref: string;
  tasksHref: string;
  activityHref: string;
  capabilitiesHref: string;
  conversationList?: ReactNode;
  attentionCount?: number;
  /** True while the project chat route is open, which decides conversation highlighting. */
  isConversationRoute: boolean;
  activeConversationId?: string;
}

export interface WorkSidebarNavProps {
  workspacesHref: string;
  workspace?: WorkSidebarWorkspace;
  activeProjectId?: string;
  project?: WorkSidebarProject;
  /** Listed only when no workspace is open, as a way back into one. */
  workspaceShortcuts?: Array<{ id: string; name: string; href: string }>;
  onSearch: () => void;
  onNavigate: () => void;
  onNewConversation: () => void;
}

export function WorkSidebarNav({
  workspacesHref,
  workspace,
  activeProjectId,
  project,
  workspaceShortcuts,
  onSearch,
  onNavigate,
  onNewConversation,
}: WorkSidebarNavProps) {
  const linkClass = sidebarNavLinkClass;

  return (
    <nav className="space-y-5 p-2 pb-8">
      <div className="space-y-1">
        <SidebarNavButton icon={<Search size={17} />} onClick={onSearch} shortcut="⌘K">
          Search
        </SidebarNavButton>
        <NavLink href={workspacesHref} end className={linkClass} onClick={onNavigate}>
          <LayoutDashboard size={17} /> Workspaces
        </NavLink>
      </div>

      {workspace && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
              {workspace.name}
            </p>
          </div>
          <NavLink href={workspace.projectsHref} end className={linkClass} onClick={onNavigate}>
            <FolderKanban size={16} /> Projects
          </NavLink>
          <NavLink href={workspace.membersHref} className={linkClass} onClick={onNavigate}>
            <Users size={16} /> People
          </NavLink>
          {(workspace.role === "owner" || workspace.role === "admin") && (
            <NavLink href={workspace.governanceHref} className={linkClass} onClick={onNavigate}>
              <ClipboardList size={16} /> Governance
            </NavLink>
          )}
        </div>
      )}

      {workspace && workspace.projects.length > 0 && (
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Projects
          </p>
          <ul className="space-y-1">
            {workspace.projects.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={item.href}
                  className={({ isActive }) =>
                    cn(linkClass({ isActive: isActive || item.id === activeProjectId }), "group")
                  }
                  onClick={onNavigate}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.colour }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {project && (
        <div className="space-y-1">
          <Link
            href={project.newConversationHref}
            aria-current={
              project.isConversationRoute && !project.activeConversationId ? "page" : undefined
            }
            className={linkClass({
              isActive: project.isConversationRoute && !project.activeConversationId,
            })}
            onClick={() => {
              onNewConversation();
              onNavigate();
            }}
          >
            <SquarePen size={16} /> New conversation
          </Link>
          <NavLink href={project.experiencesHref} className={linkClass} onClick={onNavigate}>
            <Grid2X2 size={16} /> Experiences
          </NavLink>
          <NavLink href={project.outputsHref} className={linkClass} onClick={onNavigate}>
            <PanelsTopLeft size={16} /> Outputs
          </NavLink>
          <NavLink href={project.sourcesHref} className={linkClass} onClick={onNavigate}>
            <Database size={16} /> Sources
          </NavLink>
          <NavLink href={project.tasksHref} className={linkClass} onClick={onNavigate}>
            <ListChecks size={16} /> Tasks
            {project.attentionCount ? (
              <Badge
                variant="warning"
                className="ml-auto min-w-5 px-1.5"
                aria-label={`${project.attentionCount} tasks need attention`}
              >
                {project.attentionCount}
              </Badge>
            ) : null}
          </NavLink>
          <NavLink href={project.activityHref} className={linkClass} onClick={onNavigate}>
            <Activity size={16} /> Activity
          </NavLink>
          <NavLink href={project.capabilitiesHref} className={linkClass} onClick={onNavigate}>
            <Settings2 size={16} /> Capabilities
          </NavLink>
          {project.conversationList}
        </div>
      )}

      {workspaceShortcuts?.length ? (
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Your workspaces
          </p>
          <ul className="space-y-1">
            {workspaceShortcuts.map((item) => (
              <li key={item.id}>
                <NavLink href={item.href} className={linkClass} onClick={onNavigate}>
                  <FolderKanban size={16} />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
