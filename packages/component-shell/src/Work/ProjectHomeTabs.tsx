import { cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import { getProjectBasePath } from "@ngriffin_uk/polychat-library-react";
import { Activity, FolderOpen, ListChecks, Settings } from "lucide-react";
import type { ReactNode } from "react";

export type ProjectHomeTab = "tasks" | "files" | "activity" | "settings";

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
  const basePath = getProjectBasePath(workspaceId, projectId);
  const tabs: Array<ProjectSectionLink & { id: ProjectHomeTab }> = [
    { id: "tasks", label: "Tasks", href: basePath, icon: <ListChecks size={15} /> },
    { id: "files", label: "Files", href: `${basePath}/files`, icon: <FolderOpen size={15} /> },
    {
      id: "activity",
      label: "Activity",
      href: `${basePath}/activity`,
      icon: <Activity size={15} />,
    },
    {
      id: "settings",
      label: "Settings",
      href: `${basePath}/settings`,
      icon: <Settings size={15} />,
    },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <nav aria-label="Project sections">
        <ul className="flex flex-wrap items-center gap-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <NavLink href={tab.href} end={tab.id === "tasks"} className={tabClass}>
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
