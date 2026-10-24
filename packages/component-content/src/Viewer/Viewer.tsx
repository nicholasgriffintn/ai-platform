import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { PanelRightClose, X } from "lucide-react";
import type { ReactNode } from "react";

import { ViewerHeader, type ViewerHeaderProps } from "./ViewerHeader";

const VIEWER_BAR_CLASS = "h-14 shrink-0 border-b border-border px-4";

export interface ViewerSidePanel {
  title: string;
  content: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  fill?: boolean;
}

export interface ViewerProps extends ViewerHeaderProps {
  stage: ReactNode;
  toolbar?: ReactNode;
  side?: ViewerSidePanel | null;
  onClose?: () => void;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="icon"
      size="sm"
      icon={<X size={16} />}
      aria-label="Close file"
      title="Close"
      onClick={onClose}
    />
  );
}

function SidePanel({ panel, onClose }: { panel: ViewerSidePanel; onClose?: () => void }) {
  return (
    <aside
      aria-label={panel.title}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-canvas [overflow-wrap:anywhere] lg:w-[420px] lg:shrink-0 lg:border-l lg:border-border"
    >
      <div className={cn("flex items-center gap-1", VIEWER_BAR_CLASS)}>
        <h2 className="m-0 min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {panel.title}
        </h2>
        {panel.actions}
        <Button
          variant="icon"
          size="sm"
          icon={<PanelRightClose size={15} />}
          aria-label={`Hide ${panel.title}`}
          title="Hide panel"
          onClick={panel.onClose}
        />
        {onClose ? <CloseButton onClose={onClose} /> : null}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          panel.fill ? "flex flex-col overflow-hidden" : "overflow-y-auto p-4",
        )}
      >
        {panel.content}
      </div>
    </aside>
  );
}

export function Viewer({
  stage,
  toolbar,
  side,
  onClose,
  className,
  actions,
  ...header
}: ViewerProps) {
  return (
    <div className={cn("flex h-full min-h-0 bg-canvas", className)}>
      <div className={cn("min-h-0 min-w-0 flex-1 flex-col", side ? "hidden lg:flex" : "flex")}>
        <ViewerHeader
          {...header}
          className={VIEWER_BAR_CLASS}
          actions={
            <>
              {actions}
              {onClose && !side ? <CloseButton onClose={onClose} /> : null}
            </>
          }
        />
        <div className="min-h-0 flex-1 overflow-auto">{stage}</div>
        {toolbar ? (
          <div className="flex shrink-0 justify-center px-4 pt-2 pb-4">
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-lg">
              {toolbar}
            </div>
          </div>
        ) : null}
      </div>
      {side ? <SidePanel panel={side} onClose={onClose} /> : null}
    </div>
  );
}
