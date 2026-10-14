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
  PROJECT_WORKBENCH_PANES_PER_COLUMN,
  isProjectWorkbenchPaneFullHeight,
  useElementWidth,
  type ProjectWorkbenchLayout,
  type ProjectWorkbenchPane,
  type ProjectWorkbenchStatus,
} from "@ngriffin_uk/polychat-utility-react";
import { ArrowLeft, PanelRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { ProjectWorkbenchPaneLauncher } from "./ProjectWorkbenchPaneLauncher";
import { ProjectWorkbenchPanelFrame } from "./ProjectWorkbenchPanelFrame";
import {
  FLUSH_PANES,
  PANE_PRESENTATION,
  STATUS_PRESENTATION,
} from "./projectWorkbenchPresentation";
import { ProjectWorkbenchRunStatus } from "./ProjectWorkbenchRunStatus";
import { ProjectWorkbenchToolbar } from "./ProjectWorkbenchToolbar";
import {
  useProjectWorkbenchAttention,
  type ConversationWorkbenchAttention,
} from "./useProjectWorkbenchAttention";
import { WORKBENCH_RAIL_WIDTH, useProjectWorkbenchGeometry } from "./useProjectWorkbenchGeometry";

const DOCK_MEDIA_QUERY = "(min-width: 1024px)";

export { PROJECT_WORKBENCH_PANES, type ProjectWorkbenchPane, type ProjectWorkbenchStatus };
export type { ConversationWorkbenchAttention };

export interface ProjectWorkbenchHeaderSlots {
  actions?: ReactNode;
  status?: ReactNode;
}

export interface ProjectWorkbenchShellProps {
  conversation: ReactNode;
  header: (slots: ProjectWorkbenchHeaderSlots) => ReactNode;
  context?: ReactNode;
  contextLabel?: string;
  panels: Partial<Record<ProjectWorkbenchPane, ReactNode>>;
  availablePanes?: readonly ProjectWorkbenchPane[];
  attention?: ConversationWorkbenchAttention;
  status: ProjectWorkbenchStatus;
  statusDetail?: string;
  showStatus?: boolean;
  title?: string;
  layout: ProjectWorkbenchLayout;
  onPaneClose?: (pane: ProjectWorkbenchPane) => void;
  runControls?: ReactNode;
}

export function ProjectWorkbenchShell({
  conversation,
  header,
  context,
  contextLabel,
  panels,
  availablePanes = PROJECT_WORKBENCH_PANES,
  attention,
  status,
  statusDetail,
  showStatus = true,
  title = "Project workbench",
  layout,
  onPaneClose,
  runControls,
}: ProjectWorkbenchShellProps) {
  const hasDock = useMediaQuery(DOCK_MEDIA_QUERY);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<ProjectWorkbenchPane | null>(null);
  const [expandedPane, setExpandedPane] = useState<ProjectWorkbenchPane | null>(null);
  const hasContext = context !== undefined && context !== null;
  const panes = availablePanes.filter((pane) => panels[pane] !== undefined);
  const openPanes = layout.openPanes.filter((pane) => panes.includes(pane));
  const { ref: containerRef, width: containerWidth } = useElementWidth<HTMLDivElement>();
  const geometry = useProjectWorkbenchGeometry({
    containerRef,
    containerWidth,
    layout,
    hasContext,
    openPanes,
  });
  const visibleExpandedPane =
    expandedPane && geometry.visiblePanes.includes(expandedPane) ? expandedPane : null;

  if (hasDock && mobileOpen) {
    setMobileOpen(false);
  }

  const { hasUnseenContext } = useProjectWorkbenchAttention({
    attention,
    status,
    hasDock,
    layout,
    contextIsVisible: hasDock ? geometry.showRail : mobileOpen && mobilePane === null,
    panelsHiddenByRail: geometry.panelsHiddenByRail,
    onMobilePane: (pane) => {
      setMobilePane(pane);
      setMobileOpen(true);
    },
  });

  const closePane = (pane: ProjectWorkbenchPane) => {
    if (expandedPane === pane) {
      setExpandedPane(null);
    }

    if (mobilePane === pane) {
      setMobilePane(null);
    }

    layout.closePane(pane);
    onPaneClose?.(pane);
  };

  const togglePane = (pane: ProjectWorkbenchPane) => {
    if (openPanes.includes(pane)) {
      closePane(pane);

      return;
    }

    layout.openPane(pane);

    if (geometry.panelsHiddenByRail) {
      layout.setContextOpen(false);
    }
  };

  const mobileButton =
    hasContext || panes.length > 0 ? (
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={mobileOpen ? "iconActive" : "icon"}
          size="icon"
          title="Context and panels"
          aria-label={contextLabel ? `Context and panels · ${contextLabel}` : "Context and panels"}
          className="relative"
          icon={<PanelRight className="size-4" />}
        >
          {hasUnseenContext ? (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-creative"
            />
          ) : null}
        </Button>
      </DialogTrigger>
    ) : null;

  return (
    <Dialog
      open={mobileOpen}
      onOpenChange={(open) => {
        setMobileOpen(open);

        if (!open) {
          setMobilePane(null);
        }
      }}
    >
      <div
        ref={containerRef}
        data-active-work={STATUS_PRESENTATION[status].activeWork}
        className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas"
      >
        {header({
          status: showStatus ? (
            <ProjectWorkbenchRunStatus status={status} statusDetail={statusDetail} />
          ) : undefined,
          actions: (
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              {runControls}
              {hasDock ? (
                <ProjectWorkbenchToolbar
                  hasContext={hasContext}
                  contextOpen={geometry.showRail}
                  contextLabel={contextLabel}
                  hasUnseenContext={hasUnseenContext}
                  onToggleContext={() => layout.setContextOpen(!layout.contextOpen)}
                  panes={panes}
                  openPanes={geometry.visiblePanes}
                  onTogglePane={togglePane}
                />
              ) : (
                mobileButton
              )}
            </div>
          ),
        })}
        <div className="flex min-h-0 flex-1">
          <main aria-label="Conversation" className="min-w-0 flex-1">
            {conversation}
          </main>
          {hasDock && (geometry.showRail || geometry.columnCount > 0) ? (
            <div className="flex min-h-0 shrink-0" style={{ width: geometry.workbenchWidth }}>
              {geometry.columnCount > 0 ? (
                <button
                  type="button"
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- window splitter pattern requires focusable separator with arrow-key resizing and valuemin/max/now; native hr is non-interactive and cannot host resize activation
                  role="separator"
                  aria-label="Resize workbench panels"
                  aria-orientation="vertical"
                  aria-valuemin={geometry.resize.min}
                  aria-valuemax={geometry.resize.max}
                  aria-valuenow={geometry.resize.now}
                  tabIndex={0}
                  className="group relative m-0 w-2 shrink-0 cursor-col-resize touch-none border-0 bg-transparent p-0 focus-visible:outline-none"
                  {...geometry.resize.handleProps}
                >
                  <span
                    aria-hidden="true"
                    className="polychat-motion-micro absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full group-hover:bg-active-work/60 group-focus-visible:bg-active-work"
                  />
                </button>
              ) : (
                <span aria-hidden="true" className="w-2 shrink-0" />
              )}
              <div
                id="project-workbench-desktop"
                className="flex min-h-0 min-w-0 flex-1 gap-2 py-2 pr-2"
              >
                {geometry.showRail ? (
                  <aside
                    id="project-workbench-context"
                    aria-label={`${title} context`}
                    className="flex min-h-0 shrink-0 flex-col gap-2 overflow-y-auto"
                    style={{ width: WORKBENCH_RAIL_WIDTH }}
                  >
                    {context}
                  </aside>
                ) : null}
                {geometry.columnCount > 0 ? (
                  <section
                    aria-label={`${title} panels`}
                    className="grid min-h-0 min-w-0 flex-1 gap-2"
                    style={{
                      gridAutoFlow: "column",
                      gridTemplateColumns: visibleExpandedPane
                        ? "minmax(0, 1fr)"
                        : `repeat(${geometry.columnCount}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${PROJECT_WORKBENCH_PANES_PER_COLUMN}, minmax(0, 1fr))`,
                    }}
                  >
                    {geometry.visiblePanes.map((pane, index) => (
                      <ProjectWorkbenchPanelFrame
                        key={pane}
                        pane={pane}
                        idPrefix="project-workbench-desktop"
                        className={cn(
                          visibleExpandedPane && visibleExpandedPane !== pane && "hidden",
                        )}
                        style={
                          visibleExpandedPane === pane
                            ? { gridColumn: "1 / -1", gridRow: "1 / -1" }
                            : isProjectWorkbenchPaneFullHeight(index, geometry.visiblePanes.length)
                              ? { gridRow: `span ${PROJECT_WORKBENCH_PANES_PER_COLUMN}` }
                              : undefined
                        }
                        isExpanded={visibleExpandedPane === pane}
                        onToggleExpanded={
                          geometry.visiblePanes.length > 1
                            ? () => setExpandedPane(visibleExpandedPane === pane ? null : pane)
                            : undefined
                        }
                        onClose={() => closePane(pane)}
                      >
                        {panels[pane]}
                      </ProjectWorkbenchPanelFrame>
                    ))}
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <DialogContent
        id="project-workbench-mobile"
        aria-label={title}
        className="inset-y-0 top-0 right-0 left-auto flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-l p-0 sm:w-[min(88vw,32rem)] sm:max-w-lg lg:hidden"
      >
        <DialogHeader className="border-b border-border px-4 py-3 pr-14 text-left">
          <div className="flex items-center gap-2">
            {mobilePane ? (
              <Button
                type="button"
                variant="icon"
                size="icon"
                title="Back to context"
                aria-label="Back to context"
                onClick={() => setMobilePane(null)}
                icon={<ArrowLeft className="size-4" />}
              />
            ) : null}
            <DialogTitle>
              {mobilePane ? PANE_PRESENTATION[mobilePane].label : "Context"}
            </DialogTitle>
          </div>
          <DialogDescription>{STATUS_PRESENTATION[status].label}</DialogDescription>
        </DialogHeader>
        {mobilePane && panels[mobilePane] !== undefined ? (
          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto",
              FLUSH_PANES.includes(mobilePane) ? "p-0" : "px-4 py-3",
            )}
          >
            {panels[mobilePane]}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-canvas p-2">
            <ProjectWorkbenchPaneLauncher panes={panes} openPanes={[]} onToggle={setMobilePane} />
            {context}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
