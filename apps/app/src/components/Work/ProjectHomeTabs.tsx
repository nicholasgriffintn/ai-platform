import { cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import { FolderOpen, ListChecks, MessagesSquare } from "lucide-react";
import type { ReactNode } from "react";

import { getProjectBasePath } from "~/lib/conversation-route";

export type ProjectHomeTab = "chat" | "tasks" | "files";

function tabClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm no-underline transition-colors hover:!no-underline",
    isActive
      ? "bg-selection text-foreground font-medium"
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
  const tabs: Array<{ id: ProjectHomeTab; label: string; href: string; icon: ReactNode }> = [
    { id: "chat", label: "Chat", href: basePath, icon: <MessagesSquare size={15} /> },
    { id: "tasks", label: "Tasks", href: `${basePath}/tasks`, icon: <ListChecks size={15} /> },
    { id: "files", label: "Files", href: `${basePath}/files`, icon: <FolderOpen size={15} /> },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Project sections">
        <ul className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <NavLink href={tab.href} end={tab.id === "chat"} className={tabClass}>
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
