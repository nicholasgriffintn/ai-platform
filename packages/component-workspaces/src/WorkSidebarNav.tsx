import { SidebarNavButton, sidebarNavLinkClass } from "@ngriffin_uk/polychat-component-navigation";
import { Badge, cn, Link, NavLink } from "@ngriffin_uk/polychat-component-ui";
import {
  Activity,
  BellRing,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Search,
  SquarePen,
  Users,
  UsersRound,
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
  filesHref: string;
  tasksHref: string;
  activityHref: string;
  teammatesHref: string;
  conversationList?: ReactNode;
  attentionCount?: number;
  /** True while the project chat route is open, which decides conversation highlighting. */
  isConversationRoute: boolean;
  activeConversationId?: string;
}

export interface WorkSidebarNavProps {
  workspacesHref: string;
  attentionHref: string;
  workspace?: WorkSidebarWorkspace;
  activeProjectId?: string;
  project?: WorkSidebarProject;
  /** Listed only when no workspace is open, as a way back into one. */
  workspaceShortcuts?: Array<{ id: string; name: string; href: string }>;
  onSearch: () => void;
  onNavigate: () => void;
  onNewChat: () => void;
  onNewConversation: () => void;
}

export function WorkSidebarNav({
  workspacesHref,
  attentionHref,
  workspace,
  activeProjectId,
  project,
  workspaceShortcuts,
  onSearch,
  onNavigate,
  onNewChat,
  onNewConversation,
}: WorkSidebarNavProps) {
  const linkClass = sidebarNavLinkClass;

  return (
    <nav className="space-y-5 p-2 pb-8">
      <div className="space-y-1">
        <SidebarNavButton icon={<SquarePen size={17} />} onClick={onNewChat}>
          New chat
        </SidebarNavButton>
        <SidebarNavButton icon={<Search size={17} />} onClick={onSearch} shortcut="⌘K">
          Search
        </SidebarNavButton>
        <NavLink href={attentionHref} className={linkClass} onClick={onNavigate}>
          <BellRing size={17} /> Attention
        </NavLink>
      </div>

      <div className="space-y-1">
        <NavLink href={workspacesHref} end className={linkClass} onClick={onNavigate}>
          <LayoutDashboard size={17} /> Workspaces
        </NavLink>
      </div>

      {workspace && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2">
            <p className="min-w-0 flex-1 truncate text-xs font-bold tracking-wider text-sidebar-foreground uppercase">
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
          <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
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
          <NavLink href={project.filesHref} className={linkClass} onClick={onNavigate}>
            <FolderOpen size={16} /> Files
          </NavLink>
          <NavLink href={project.activityHref} className={linkClass} onClick={onNavigate}>
            <Activity size={16} /> Activity
          </NavLink>
          <NavLink href={project.teammatesHref} className={linkClass} onClick={onNavigate}>
            <UsersRound size={16} /> Teammates
          </NavLink>
          {project.conversationList}
        </div>
      )}

      {workspaceShortcuts?.length ? (
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
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
