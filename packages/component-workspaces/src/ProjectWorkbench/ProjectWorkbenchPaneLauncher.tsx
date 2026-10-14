import { WorkbenchCard, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectWorkbenchPane } from "@ngriffin_uk/polychat-utility-react";
import { LayoutPanelLeft } from "lucide-react";

import { PANE_PRESENTATION } from "./projectWorkbenchPresentation";

export interface ProjectWorkbenchPaneLauncherProps {
  panes: readonly ProjectWorkbenchPane[];
  openPanes: readonly ProjectWorkbenchPane[];
  onToggle: (pane: ProjectWorkbenchPane) => void;
}

export function ProjectWorkbenchPaneLauncher({
  panes,
  openPanes,
  onToggle,
}: ProjectWorkbenchPaneLauncherProps) {
  if (panes.length === 0) {
    return null;
  }

  return (
    <WorkbenchCard title="Panels" icon={LayoutPanelLeft}>
      <ul className="flex flex-wrap gap-1.5">
        {panes.map((pane) => {
          const presentation = PANE_PRESENTATION[pane];
          const Icon = presentation.icon;
          const isOpen = openPanes.includes(pane);

          return (
            <li key={pane}>
              <button
                type="button"
                aria-pressed={isOpen}
                onClick={() => onToggle(pane)}
                className={cn(
                  "polychat-motion-micro inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isOpen
                    ? "border-active-work/40 bg-selection text-active-work"
                    : "border-border text-muted-foreground hover:bg-selection hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {presentation.label}
              </button>
            </li>
          );
        })}
      </ul>
    </WorkbenchCard>
  );
}
