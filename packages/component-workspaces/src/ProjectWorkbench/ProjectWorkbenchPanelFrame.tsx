import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import type { ProjectWorkbenchPane } from "@ngriffin_uk/polychat-utility-react";
import { Maximize2, Minimize2, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { FLUSH_PANES, PANE_PRESENTATION } from "./projectWorkbenchPresentation";

export interface ProjectWorkbenchPanelFrameProps {
  pane: ProjectWorkbenchPane;
  idPrefix: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onClose: () => void;
  leading?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ProjectWorkbenchPanelFrame({
  pane,
  idPrefix,
  isExpanded = false,
  onToggleExpanded,
  onClose,
  leading,
  className,
  style,
  children,
}: ProjectWorkbenchPanelFrameProps) {
  const presentation = PANE_PRESENTATION[pane];
  const Icon = presentation.icon;
  const titleId = `${idPrefix}-${pane}-title`;

  return (
    <section
      id={`${idPrefix}-${pane}-panel`}
      aria-labelledby={titleId}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-xl border border-border bg-surface",
        className,
      )}
      style={style}
    >
      <header className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border pr-1 pl-3">
        {leading}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 id={titleId} className="truncate text-xs font-medium text-foreground">
          {presentation.label}
        </h2>
        <div className="ml-auto flex shrink-0 items-center">
          {onToggleExpanded ? (
            <Button
              type="button"
              variant="icon"
              size="sm"
              title={isExpanded ? "Restore panel layout" : `Give ${presentation.label} the room`}
              aria-label={
                isExpanded
                  ? `Restore ${presentation.label} panel`
                  : `Expand ${presentation.label} panel`
              }
              aria-pressed={isExpanded}
              onClick={onToggleExpanded}
              icon={
                isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />
              }
            />
          ) : null}
          <Button
            type="button"
            variant="icon"
            size="sm"
            title={`Close ${presentation.label}`}
            aria-label={`Close ${presentation.label} panel`}
            onClick={onClose}
            icon={<X className="size-3.5" />}
          />
        </div>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto",
          FLUSH_PANES.includes(pane) ? "p-0" : "px-4 py-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}
