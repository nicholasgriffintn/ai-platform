import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  cn,
  useMediaQuery,
} from "@ngriffin_uk/polychat-component-ui";
import {
  PROJECT_WORKBENCH_PANES,
  type ProjectWorkbenchPane,
  type ProjectWorkbenchStatus,
} from "@ngriffin_uk/polychat-utility-react";
import {
  Activity,
  Bot,
  FileDiff,
  Files,
  MonitorPlay,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { useWorkbenchDockResize } from "./useWorkbenchDockResize";

const DOCK_MEDIA_QUERY = "(min-width: 1024px)";

export { PROJECT_WORKBENCH_PANES, type ProjectWorkbenchPane, type ProjectWorkbenchStatus };

export interface ProjectWorkbenchHeaderSlots {
  actions?: ReactNode;
  status?: ReactNode;
}

export interface ConversationWorkbenchAttention {
  key: string;
  pane: ProjectWorkbenchPane;
}

export interface ProjectWorkbenchShellProps {
  conversation: ReactNode;
  header: (slots: ProjectWorkbenchHeaderSlots) => ReactNode;
  panels: Partial<Record<ProjectWorkbenchPane, ReactNode>>;
  availablePanes?: readonly ProjectWorkbenchPane[];
  attention?: ConversationWorkbenchAttention;
  status: ProjectWorkbenchStatus;
  statusDetail?: string;
  showStatus?: boolean;
  title?: string;
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
const MIN_CONVERSATION_WIDTH = 384;
const COMPACT_PANE_TABS_WIDTH = 520;

const PANE_PRESENTATION = {
  context: { label: "Context", icon: NotebookPen },
  activity: { label: "Activity", icon: Activity },
  preview: { label: "Preview", icon: MonitorPlay },
  changes: { label: "Changes", icon: FileDiff },
  files: { label: "Files", icon: Files },
  proof: { label: "Proof", icon: ShieldCheck },
  delegates: { label: "Delegates", icon: Bot },
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
  panes,
  selectedPane,
  onSelectedPaneChange,
  idPrefix,
  compact = false,
}: Pick<ProjectWorkbenchShellProps, "selectedPane" | "onSelectedPaneChange"> & {
  panes: readonly ProjectWorkbenchPane[];
  idPrefix: string;
  compact?: boolean;
}) {
  const handleKeyDown = (pane: ProjectWorkbenchPane, event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = panes.indexOf(pane);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % panes.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + panes.length) % panes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = panes.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextPane = panes[nextIndex];

    if (!nextPane) {
      return;
    }

    onSelectedPaneChange(nextPane);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#${idPrefix}-${nextPane}-tab`)
      ?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Workbench panels"
      className="flex min-w-0 gap-1 overflow-x-auto p-1"
    >
      {panes.map((pane) => {
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
              "polychat-motion-micro inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selectedPane === pane
                ? "bg-selection text-active-work"
                : "text-muted-foreground hover:bg-selection hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className={cn(compact && "sr-only")}>{presentation.label}</span>
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
      {panels[selectedPane] ?? null}
    </section>
  );
}

function RunStatusSummary({
  status,
  statusDetail,
}: Pick<ProjectWorkbenchShellProps, "status" | "statusDetail">) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <output
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-2",
        presentation.requiresAttention && "rounded-md bg-attention/10 px-2 py-1",
      )}
      title={statusDetail ? `${presentation.label} · ${statusDetail}` : presentation.label}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          presentation.tone,
          presentation.animated && "polychat-motion-active-execution",
        )}
      />
      <span
        className={cn(
          "shrink-0 text-xs font-medium sm:text-sm",
          presentation.requiresAttention && "text-attention",
        )}
      >
        {presentation.label}
      </span>
      {statusDetail ? (
        <>
          <span className="sr-only">: {statusDetail}</span>
          <span
            aria-hidden="true"
            className="hidden min-w-0 truncate text-xs text-muted-foreground @min-[48rem]:block"
          >
            {statusDetail}
          </span>
        </>
      ) : null}
    </output>
  );
}

export function ProjectWorkbenchShell({
  conversation,
  header,
  panels,
  availablePanes = PROJECT_WORKBENCH_PANES,
  attention,
  status,
  statusDetail,
  showStatus = true,
  title = "Project workbench",
  selectedPane,
  onSelectedPaneChange,
  dockCollapsed,
  onDockCollapsedChange,
  dockWidth,
  onDockWidthChange,
  runControls,
}: ProjectWorkbenchShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasDock = useMediaQuery(DOCK_MEDIA_QUERY);
  const panes = availablePanes.filter((pane) => panels[pane] !== undefined);
  const activePane = panes.includes(selectedPane) ? selectedPane : (panes[0] ?? selectedPane);
  const previousAttentionKey = useRef(attention?.key);
  const attentionInitialised = useRef(false);

  useEffect(() => {
    if (hasDock) {
      setMobileOpen(false);
    }
  }, [hasDock]);

  useEffect(() => {
    const previous = previousAttentionKey.current;

    previousAttentionKey.current = attention?.key;

    if (!attentionInitialised.current) {
      attentionInitialised.current = true;

      return;
    }

    if (!attention || previous === attention.key) {
      return;
    }

    onSelectedPaneChange(attention.pane);

    if (hasDock) {
      onDockCollapsedChange(false);
    } else {
      setMobileOpen(true);
    }
  }, [attention, hasDock, onDockCollapsedChange, onSelectedPaneChange]);

  const { containerRef, effectiveMaxWidth, effectiveWidth, resizeHandleProps } =
    useWorkbenchDockResize({
      width: dockWidth,
      minWidth: MIN_DOCK_WIDTH,
      maxWidth: MAX_DOCK_WIDTH,
      minConversationWidth: MIN_CONVERSATION_WIDTH,
      onWidthChange: onDockWidthChange,
    });
  const panelIsOpen = hasDock ? !dockCollapsed : mobileOpen;
  const panelButton =
    panes.length > 0 ? (
      <Button
        type="button"
        variant={panelIsOpen ? "iconActive" : "icon"}
        size="icon"
        title={panelIsOpen ? "Close workbench panels" : "Open workbench panels"}
        aria-label={panelIsOpen ? "Close workbench panels" : "Open workbench panels"}
        aria-expanded={panelIsOpen}
        aria-controls={hasDock ? "project-workbench-desktop" : "project-workbench-mobile"}
        onClick={hasDock ? () => onDockCollapsedChange(!dockCollapsed) : undefined}
        icon={
          panelIsOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )
        }
      />
    ) : null;

  return (
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
      <div
        ref={containerRef}
        data-active-work={STATUS_PRESENTATION[status].activeWork}
        className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas"
      >
        {header({
          status: showStatus ? (
            <RunStatusSummary status={status} statusDetail={statusDetail} />
          ) : undefined,
          actions: (
            <div className="flex min-w-0 shrink-0 items-center gap-0.5">
              {runControls}
              {panelButton ? (
                hasDock ? (
                  panelButton
                ) : (
                  <DialogTrigger asChild>{panelButton}</DialogTrigger>
                )
              ) : null}
            </div>
          ),
        })}
        <div className="flex min-h-0 flex-1">
          <main aria-label="Conversation" className="min-w-0 flex-1 lg:min-w-96">
            {conversation}
          </main>
          <div className="relative hidden min-h-0 lg:flex">
            {!dockCollapsed && panes.length > 0 ? (
              <>
                <button
                  type="button"
                  role="separator"
                  aria-label="Resize workbench panels"
                  aria-orientation="vertical"
                  aria-valuemin={MIN_DOCK_WIDTH}
                  aria-valuemax={effectiveMaxWidth}
                  aria-valuenow={effectiveWidth}
                  tabIndex={0}
                  className="polychat-motion-micro m-0 w-1 cursor-col-resize touch-none border-0 bg-border hover:bg-active-work focus-visible:bg-active-work focus-visible:outline-2 focus-visible:outline-ring"
                  {...resizeHandleProps}
                />
                <aside
                  id="project-workbench-desktop"
                  aria-label={title}
                  className="polychat-motion-panel flex min-h-0 flex-col border-l border-border bg-surface"
                  style={{ width: effectiveWidth }}
                >
                  <div className="min-w-0 border-b border-border">
                    <PaneTabs
                      panes={panes}
                      selectedPane={activePane}
                      onSelectedPaneChange={onSelectedPaneChange}
                      idPrefix="project-workbench-desktop"
                      compact={effectiveWidth < COMPACT_PANE_TABS_WIDTH}
                    />
                  </div>
                  <SelectedPane
                    selectedPane={activePane}
                    panels={panels}
                    idPrefix="project-workbench-desktop"
                  />
                </aside>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <DialogContent
        id="project-workbench-mobile"
        className="inset-y-0 top-0 right-0 left-auto flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-l p-0 sm:w-[min(88vw,32rem)] sm:max-w-lg lg:hidden"
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-14 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{STATUS_PRESENTATION[status].label}</DialogDescription>
        </DialogHeader>
        <div className="border-b border-border px-2">
          <PaneTabs
            panes={panes}
            selectedPane={activePane}
            onSelectedPaneChange={onSelectedPaneChange}
            idPrefix="project-workbench-mobile"
            compact
          />
        </div>
        <SelectedPane
          selectedPane={activePane}
          panels={panels}
          idPrefix="project-workbench-mobile"
        />
      </DialogContent>
    </Dialog>
  );
}
