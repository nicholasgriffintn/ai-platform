import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  cn,
} from "@ngriffin_uk/polychat-component-ui";
import {
  Activity,
  FileDiff,
  Files,
  LayoutPanelTop,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

import { useWorkbenchDockResize } from "./useWorkbenchDockResize";

export const PROJECT_WORKBENCH_PANES = [
  "activity",
  "preview",
  "changes",
  "files",
  "proof",
] as const;

export type ProjectWorkbenchPane = (typeof PROJECT_WORKBENCH_PANES)[number];

export type ProjectWorkbenchStatus =
  | "ready"
  | "queued"
  | "preparing"
  | "running"
  | "paused"
  | "waiting_approval"
  | "waiting_input"
  | "review"
  | "completed"
  | "failed"
  | "cancelled";

export interface ProjectWorkbenchShellProps {
  conversation: ReactNode;
  panels: Record<ProjectWorkbenchPane, ReactNode>;
  status: ProjectWorkbenchStatus;
  statusDetail?: string;
  selectedPane: ProjectWorkbenchPane;
  onSelectedPaneChange: (pane: ProjectWorkbenchPane) => void;
  dockCollapsed: boolean;
  onDockCollapsedChange: (collapsed: boolean) => void;
  dockWidth: number;
  onDockWidthChange: (width: number) => void;
  runControls?: ReactNode;
}

const MIN_DOCK_WIDTH = 320;
const MAX_DOCK_WIDTH = 720;

const PANE_PRESENTATION = {
  activity: { label: "Activity", icon: Activity },
  preview: { label: "Preview", icon: MonitorPlay },
  changes: { label: "Changes", icon: FileDiff },
  files: { label: "Files", icon: Files },
  proof: { label: "Proof", icon: ShieldCheck },
} as const;

const STATUS_PRESENTATION: Record<
  ProjectWorkbenchStatus,
  {
    label: string;
    tone: string;
    animated: boolean;
    activeWork: boolean;
    requiresAttention?: boolean;
  }
> = {
  ready: {
    label: "Ready",
    tone: "bg-muted-foreground",
    animated: false,
    activeWork: false,
  },
  queued: { label: "Queued", tone: "bg-active-work", animated: false, activeWork: true },
  preparing: { label: "Preparing", tone: "bg-creative", animated: true, activeWork: true },
  running: { label: "Running", tone: "bg-active-work", animated: true, activeWork: true },
  paused: { label: "Paused", tone: "bg-attention", animated: false, activeWork: true },
  waiting_approval: {
    label: "Waiting for approval",
    tone: "bg-attention",
    animated: false,
    activeWork: true,
    requiresAttention: true,
  },
  waiting_input: {
    label: "Waiting for input",
    tone: "bg-attention",
    animated: false,
    activeWork: true,
    requiresAttention: true,
  },
  review: { label: "Ready for review", tone: "bg-creative", animated: false, activeWork: false },
  completed: { label: "Completed", tone: "bg-success", animated: false, activeWork: false },
  failed: { label: "Failed", tone: "bg-failure", animated: false, activeWork: false },
  cancelled: {
    label: "Cancelled",
    tone: "bg-muted-foreground",
    animated: false,
    activeWork: false,
  },
};

function PaneTabs({
  selectedPane,
  onSelectedPaneChange,
  idPrefix,
}: Pick<ProjectWorkbenchShellProps, "selectedPane" | "onSelectedPaneChange"> & {
  idPrefix: string;
}) {
  const handleKeyDown = (pane: ProjectWorkbenchPane, event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = PROJECT_WORKBENCH_PANES.indexOf(pane);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % PROJECT_WORKBENCH_PANES.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + PROJECT_WORKBENCH_PANES.length) % PROJECT_WORKBENCH_PANES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PROJECT_WORKBENCH_PANES.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextPane = PROJECT_WORKBENCH_PANES[nextIndex];

    onSelectedPaneChange(nextPane);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${idPrefix}-${nextPane}-tab`)
      ?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Project workbench panels"
      className="flex min-w-0 gap-1 overflow-x-auto p-1"
    >
      {PROJECT_WORKBENCH_PANES.map((pane) => {
        const presentation = PANE_PRESENTATION[pane];
        const Icon = presentation.icon;

        return (
          <button
            key={pane}
            id={`${idPrefix}-${pane}-tab`}
            type="button"
            role="tab"
            aria-selected={selectedPane === pane}
            aria-controls={`${idPrefix}-${pane}-panel`}
            tabIndex={selectedPane === pane ? 0 : -1}
            onClick={() => onSelectedPaneChange(pane)}
            onKeyDown={(event) => handleKeyDown(pane, event)}
            className={cn(
              "polychat-motion-micro focus-visible:outline-ring inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
              selectedPane === pane
                ? "bg-selection text-active-work"
                : "text-muted-foreground hover:bg-selection hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {presentation.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectedPane({
  selectedPane,
  panels,
  idPrefix,
}: Pick<ProjectWorkbenchShellProps, "selectedPane" | "panels"> & { idPrefix: string }) {
  return (
    <section
      id={`${idPrefix}-${selectedPane}-panel`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-${selectedPane}-tab`}
      tabIndex={0}
      className="polychat-motion-enter min-h-0 flex-1 overflow-auto px-4 py-3 outline-none"
    >
      {panels[selectedPane]}
    </section>
  );
}

function RunStatusStrip({
  status,
  statusDetail,
  runControls,
}: Pick<ProjectWorkbenchShellProps, "status" | "statusDetail" | "runControls">) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <div
      className={cn(
        "border-border bg-surface flex min-h-11 items-center gap-3 border-b px-3",
        presentation.requiresAttention && "bg-attention/10",
      )}
    >
      <output aria-live="polite" className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            presentation.tone,
            presentation.animated && "polychat-motion-active-execution",
          )}
        />
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "text-sm font-medium",
              presentation.requiresAttention && "text-attention",
            )}
          >
            {presentation.label}
          </span>
          {statusDetail ? (
            <span className="text-muted-foreground ml-2 hidden truncate text-xs sm:inline">
              {statusDetail}
            </span>
          ) : null}
        </div>
      </output>
      {runControls}
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<LayoutPanelTop className="size-4" />}
          className="lg:hidden"
        >
          Workbench
        </Button>
      </DialogTrigger>
    </div>
  );
}

export function ProjectWorkbenchShell({
  conversation,
  panels,
  status,
  statusDetail,
  selectedPane,
  onSelectedPaneChange,
  dockCollapsed,
  onDockCollapsedChange,
  dockWidth,
  onDockWidthChange,
  runControls,
}: ProjectWorkbenchShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { containerRef, resizeHandleProps } = useWorkbenchDockResize({
    width: dockWidth,
    minWidth: MIN_DOCK_WIDTH,
    maxWidth: MAX_DOCK_WIDTH,
    onWidthChange: onDockWidthChange,
  });

  return (
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
      <div
        ref={containerRef}
        data-active-work={STATUS_PRESENTATION[status].activeWork}
        className="bg-canvas flex h-full min-h-0 flex-col overflow-hidden"
      >
        <RunStatusStrip status={status} statusDetail={statusDetail} runControls={runControls} />
        <div className="flex min-h-0 flex-1">
          <main aria-label="Conversation" className="min-w-0 flex-1 lg:min-w-96">
            {conversation}
          </main>
          <div className="relative hidden min-h-0 lg:flex">
            {dockCollapsed ? (
              <div className="border-border bg-surface flex w-12 items-start justify-center border-l pt-2">
                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  title="Open workbench panels"
                  aria-label="Open workbench panels"
                  onClick={() => onDockCollapsedChange(false)}
                >
                  <PanelRightOpen className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="separator"
                  aria-label="Resize workbench panels"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_DOCK_WIDTH}
                  aria-valuemax={MAX_DOCK_WIDTH}
                  aria-valuenow={dockWidth}
                  tabIndex={0}
                  className="bg-border hover:bg-active-work focus-visible:bg-active-work focus-visible:outline-ring polychat-motion-micro m-0 w-1 cursor-col-resize touch-none border-0 focus-visible:outline-2"
                  {...resizeHandleProps}
                />
                <aside
                  aria-label="Project workbench"
                  className="bg-surface polychat-motion-panel flex min-h-0 flex-col"
                  style={{ width: dockWidth }}
                >
                  <div className="border-border flex items-center border-b pr-1">
                    <div className="min-w-0 flex-1">
                      <PaneTabs
                        selectedPane={selectedPane}
                        onSelectedPaneChange={onSelectedPaneChange}
                        idPrefix="project-workbench-desktop"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="icon"
                      size="icon"
                      title="Collapse workbench panels"
                      aria-label="Collapse workbench panels"
                      onClick={() => onDockCollapsedChange(true)}
                    >
                      <PanelRightClose className="size-4" />
                    </Button>
                  </div>
                  <SelectedPane
                    selectedPane={selectedPane}
                    panels={panels}
                    idPrefix="project-workbench-desktop"
                  />
                </aside>
              </>
            )}
          </div>
        </div>
      </div>
      <DialogContent className="inset-0 top-0 left-0 flex h-[100dvh] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none lg:hidden">
        <DialogHeader className="border-border border-b px-4 py-3 pr-14 text-left">
          <DialogTitle>Project workbench</DialogTitle>
          <DialogDescription>{STATUS_PRESENTATION[status].label}</DialogDescription>
        </DialogHeader>
        <div className="border-border border-b px-2">
          <PaneTabs
            selectedPane={selectedPane}
            onSelectedPaneChange={onSelectedPaneChange}
            idPrefix="project-workbench-mobile"
          />
        </div>
        <SelectedPane
          selectedPane={selectedPane}
          panels={panels}
          idPrefix="project-workbench-mobile"
        />
      </DialogContent>
    </Dialog>
  );
}
