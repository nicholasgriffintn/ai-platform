import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectWorkbenchPane } from "@ngriffin_uk/polychat-utility-react";
import { PanelRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PANE_PRESENTATION } from "./projectWorkbenchPresentation";

function ToolbarToggle({
  label,
  icon: Icon,
  pressed,
  onClick,
  controls,
  children,
}: {
  label: string;
  icon: LucideIcon;
  pressed: boolean;
  onClick: () => void;
  controls?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={pressed ? `Hide ${label}` : `Show ${label}`}
      aria-label={label}
      aria-pressed={pressed}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "polychat-motion-micro relative inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        pressed
          ? "bg-selection text-active-work"
          : "text-muted-foreground hover:bg-selection hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </button>
  );
}

export interface ProjectWorkbenchToolbarProps {
  hasContext: boolean;
  contextOpen: boolean;
  contextLabel?: string;
  hasUnseenContext?: boolean;
  onToggleContext: () => void;
  panes: readonly ProjectWorkbenchPane[];
  openPanes: readonly ProjectWorkbenchPane[];
  onTogglePane: (pane: ProjectWorkbenchPane) => void;
}

export function ProjectWorkbenchToolbar({
  hasContext,
  contextOpen,
  contextLabel,
  hasUnseenContext = false,
  onToggleContext,
  panes,
  openPanes,
  onTogglePane,
}: ProjectWorkbenchToolbarProps) {
  if (!hasContext && panes.length === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Workbench"
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
    >
      {hasContext ? (
        <ToolbarToggle
          label="Context"
          icon={PanelRight}
          pressed={contextOpen}
          onClick={onToggleContext}
          controls="project-workbench-context"
        >
          {contextLabel ? (
            <span className="font-mono text-[11px] tabular-nums">{contextLabel}</span>
          ) : null}
          {hasUnseenContext ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-1.5 rounded-full bg-creative"
            />
          ) : null}
        </ToolbarToggle>
      ) : null}
      {hasContext && panes.length > 0 ? (
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
      ) : null}
      {panes.map((pane) => (
        <ToolbarToggle
          key={pane}
          label={PANE_PRESENTATION[pane].label}
          icon={PANE_PRESENTATION[pane].icon}
          pressed={openPanes.includes(pane)}
          onClick={() => onTogglePane(pane)}
          controls={`project-workbench-desktop-${pane}-panel`}
        />
      ))}
    </div>
  );
}
