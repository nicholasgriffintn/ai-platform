import {
  SidebarCountBadge,
  SidebarNavButton,
  sidebarNavLinkClass,
} from "@ngriffin_uk/polychat-component-navigation";
import { cn, Link, NavLink } from "@ngriffin_uk/polychat-component-ui";
import {
  Activity,
  Boxes,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Coins,
  FolderKanban,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  ListTodo,
  Network,
  Plus,
  Settings,
  Target,
  Users,
} from "lucide-react";

import type { WorkspaceRole } from "./WorkspaceMemberList";

export interface WorkSidebarProjectLink {
  id: string;
  name: string;
  colour?: string;
  prefix?: string | null;
  href: string;
}

export interface WorkSidebarWorkspace {
  id: string;
  name: string;
  role: WorkspaceRole;
  projectsHref: string;
  initiativesHref: string;
  teamHref: string;
  costsHref: string;
  activityHref: string;
  membersHref: string;
  governanceHref: string;
  modelsHref: string;
  projects: WorkSidebarProjectLink[];
}

export interface WorkSidebarProject {
  tasksHref: string;
  tasksActive: boolean;
  triageHref: string;
  triageActive: boolean;
  triageCount?: number;
  sitesHref: string;
  filesHref: string;
  settingsHref: string;
  attentionCount?: number;
}

export interface WorkSidebarNavProps {
  inboxHref: string;
  inboxCount?: number;
  myTasksHref: string;
  workspacesHref: string;
  workspace?: WorkSidebarWorkspace;
  activeProjectId?: string;
  project?: WorkSidebarProject;
  workspaceShortcuts?: Array<{ id: string; name: string; href: string }>;
  onNavigate: () => void;
  onNewTask: () => void;
}

export function WorkSidebarNav({
  inboxHref,
  inboxCount = 0,
  myTasksHref,
  workspacesHref,
  workspace,
  activeProjectId,
  project,
  workspaceShortcuts,
  onNavigate,
  onNewTask,
}: WorkSidebarNavProps) {
  const linkClass = sidebarNavLinkClass;
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  return (
    <nav aria-label="Workspace" className="space-y-5 p-2 pb-8">
      <div className="space-y-1">
        <SidebarNavButton icon={<Plus size={17} />} onClick={onNewTask}>
          New task
        </SidebarNavButton>
        <NavLink href={inboxHref} className={linkClass} onClick={onNavigate}>
          <Inbox size={17} /> Inbox
          <SidebarCountBadge count={inboxCount} label={`${inboxCount} items waiting on you`} />
        </NavLink>
        <NavLink href={myTasksHref} className={linkClass} onClick={onNavigate}>
          <ListTodo size={17} /> My tasks
        </NavLink>
      </div>

      <div className="space-y-1">
        <NavLink href={workspacesHref} end className={linkClass} onClick={onNavigate}>
          <LayoutDashboard size={17} /> Workspaces
        </NavLink>
      </div>

      {workspace && (
        <div className="space-y-1">
          <p className="truncate px-2 pb-1 text-xs font-bold tracking-wider text-sidebar-foreground uppercase">
            {workspace.name}
          </p>
          <NavLink href={workspace.projectsHref} end className={linkClass} onClick={onNavigate}>
            <FolderKanban size={16} /> Projects
          </NavLink>
          <NavLink href={workspace.initiativesHref} className={linkClass} onClick={onNavigate}>
            <Target size={16} /> Initiatives
          </NavLink>
          <NavLink href={workspace.teamHref} className={linkClass} onClick={onNavigate}>
            <Network size={16} /> Team
          </NavLink>
          <NavLink href={workspace.costsHref} className={linkClass} onClick={onNavigate}>
            <Coins size={16} /> Costs
          </NavLink>
          <NavLink href={workspace.activityHref} className={linkClass} onClick={onNavigate}>
            <Activity size={16} /> Activity
          </NavLink>
          <NavLink href={workspace.membersHref} className={linkClass} onClick={onNavigate}>
            <Users size={16} /> People
          </NavLink>
          <NavLink href={workspace.modelsHref} className={linkClass} onClick={onNavigate}>
            <Boxes size={16} /> Models
          </NavLink>
          {canManage && (
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
                  {item.prefix ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.prefix}
                    </span>
                  ) : (
                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
                  )}
                </NavLink>
                {project && item.id === activeProjectId && (
                  <div className="mt-1 space-y-1 pl-4">
                    <Link
                      href={project.tasksHref}
                      aria-current={project.tasksActive ? "page" : undefined}
                      className={linkClass({ isActive: project.tasksActive })}
                      onClick={onNavigate}
                    >
                      <ListChecks size={15} /> Tasks
                      <SidebarCountBadge
                        count={project.attentionCount ?? 0}
                        label={`${project.attentionCount} tasks need attention`}
                      />
                    </Link>
                    <Link
                      href={project.triageHref}
                      aria-current={project.triageActive ? "page" : undefined}
                      className={linkClass({ isActive: project.triageActive })}
                      onClick={onNavigate}
                    >
                      <CircleDot size={15} /> Triage
                      <SidebarCountBadge
                        count={project.triageCount ?? 0}
                        label={`${project.triageCount} cases to triage`}
                      />
                    </Link>
                    <NavLink href={project.filesHref} className={linkClass} onClick={onNavigate}>
                      <FolderOpen size={15} /> Files
                    </NavLink>
                    <NavLink href={project.sitesHref} className={linkClass} onClick={onNavigate}>
                      <LayoutTemplate size={15} /> Sites
                    </NavLink>
                    <NavLink href={project.settingsHref} className={linkClass} onClick={onNavigate}>
                      <Settings size={15} /> Settings
                    </NavLink>
                  </div>
                )}
              </li>
            ))}
          </ul>
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
