import {
  cn,
  DropdownMenu,
  DropdownMenuItem,
  Link,
  NavLink,
} from "@ngriffin_uk/polychat-component-ui";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import {
  Activity,
  CalendarClock,
  ChevronDown,
  FolderOpen,
  ListChecks,
  MessagesSquare,
  Plug,
  Settings,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

export type ProjectHomeTab = "chat" | "tasks" | "files" | "activity";

interface ProjectSectionLink {
  label: string;
  href: string;
  icon: ReactNode;
}

function tabClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm no-underline transition-colors hover:!no-underline",
    isActive
      ? "bg-selection font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function ProjectHomeTabs({
  workspaceId,
  projectId,
  actions,
}: {
  workspaceId: string;
  projectId: string;
  actions?: ReactNode;
}) {
  const { pathname } = useLocation();
  const basePath = getProjectBasePath(workspaceId, projectId);
  const tabs: Array<ProjectSectionLink & { id: ProjectHomeTab }> = [
    { id: "chat", label: "Overview", href: basePath, icon: <MessagesSquare size={15} /> },
    { id: "tasks", label: "Tasks", href: `${basePath}/tasks`, icon: <ListChecks size={15} /> },
    { id: "files", label: "Files", href: `${basePath}/files`, icon: <FolderOpen size={15} /> },
    {
      id: "activity",
      label: "Activity",
      href: `${basePath}/activity`,
      icon: <Activity size={15} />,
    },
  ];
  const moreLinks: ProjectSectionLink[] = [
    { label: "Teammates", href: `${basePath}/teammates`, icon: <UsersRound size={15} /> },
    { label: "Scheduled", href: `${basePath}/scheduled`, icon: <CalendarClock size={15} /> },
    { label: "Plugins", href: `${basePath}/plugins`, icon: <Plug size={15} /> },
    { label: "Settings", href: `${basePath}/settings`, icon: <Settings size={15} /> },
  ];
  const activeMoreLink = moreLinks.find(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Project sections">
        <ul className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <NavLink href={tab.href} end={tab.id === "chat"} className={tabClass}>
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
          <li>
            <DropdownMenu
              trigger={
                <span className="flex items-center gap-1">
                  {activeMoreLink?.label ?? "More"}
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              }
              buttonProps={{
                variant: "ghost",
                size: "sm",
                className: tabClass({ isActive: Boolean(activeMoreLink) }),
              }}
            >
              {moreLinks.map((link) => (
                <DropdownMenuItem key={link.href} icon={link.icon} asChild>
                  <Link
                    href={link.href}
                    aria-current={link === activeMoreLink ? "page" : undefined}
                    className="no-underline hover:!no-underline"
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenu>
          </li>
        </ul>
      </nav>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
