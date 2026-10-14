import type {
  SandboxPreviewAccess,
  SandboxPreviewState,
  SandboxServiceStatus,
} from "@ngriffin_uk/polychat-schemas";

export const PROJECT_WORKBENCH_PANES = [
  "brief",
  "artifact",
  "activity",
  "preview",
  "changes",
  "files",
  "proof",
  "delegates",
] as const;

export type ProjectWorkbenchPane = (typeof PROJECT_WORKBENCH_PANES)[number];

export const PROJECT_WORKBENCH_PANES_PER_COLUMN = 2;
export const PROJECT_WORKBENCH_MAX_COLUMNS = 2;
export const PROJECT_WORKBENCH_MAX_OPEN_PANES =
  PROJECT_WORKBENCH_PANES_PER_COLUMN * PROJECT_WORKBENCH_MAX_COLUMNS;

export interface ProjectWorkbenchLayout {
  contextOpen: boolean;
  openPanes: readonly ProjectWorkbenchPane[];
  columnWidth: number;
  setContextOpen: (open: boolean) => void;
  openPane: (pane: ProjectWorkbenchPane) => void;
  closePane: (pane: ProjectWorkbenchPane) => void;
  setColumnWidth: (width: number) => void;
}

export function openProjectWorkbenchPane(
  openPanes: readonly ProjectWorkbenchPane[],
  pane: ProjectWorkbenchPane,
): ProjectWorkbenchPane[] {
  if (openPanes.includes(pane)) {
    return [...openPanes];
  }

  return [...openPanes, pane].slice(-PROJECT_WORKBENCH_MAX_OPEN_PANES);
}

export function isProjectWorkbenchPaneFullHeight(index: number, visibleCount: number): boolean {
  return index % PROJECT_WORKBENCH_PANES_PER_COLUMN === 0 && index === visibleCount - 1;
}

export function arrangeProjectWorkbenchColumns(
  openPanes: readonly ProjectWorkbenchPane[],
  maxColumns: number,
): ProjectWorkbenchPane[][] {
  const capacity = Math.max(1, maxColumns) * PROJECT_WORKBENCH_PANES_PER_COLUMN;
  const visible = openPanes.slice(-capacity);
  const columns: ProjectWorkbenchPane[][] = [];

  for (let index = 0; index < visible.length; index += PROJECT_WORKBENCH_PANES_PER_COLUMN) {
    columns.push(visible.slice(index, index + PROJECT_WORKBENCH_PANES_PER_COLUMN));
  }

  return columns;
}

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

export interface ProjectWorkbenchApprovalItem {
  id: string;
  command?: string;
  state: "escalated" | "pending";
}

export interface ProjectWorkbenchServiceItem {
  name: string;
  status: SandboxServiceStatus;
  expectedPort?: number;
  restartCount: number;
  updatedAt?: string;
  error?: string;
}

export interface ProjectWorkbenchPreviewRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ProjectWorkbenchPreviewDisplayState = SandboxPreviewState | "loading";

export interface ProjectWorkbenchPreviewViewport {
  id: "fit" | "mobile" | "tablet" | "desktop";
  label: string;
  width?: number;
  height: number;
}

export interface ProjectWorkbenchPreviewFeedback {
  annotation: string;
  elementReference?: string;
  region?: ProjectWorkbenchPreviewRegion;
  route: string;
  serviceName: string;
  viewport: ProjectWorkbenchPreviewViewport;
}

export function isProjectWorkbenchPreviewReady(
  state: ProjectWorkbenchPreviewDisplayState,
  preview?: SandboxPreviewAccess,
): preview is SandboxPreviewAccess & { url: string } {
  return state === "healthy" && Boolean(preview?.url);
}

export function getProjectWorkbenchPreviewRegionStyle(region: ProjectWorkbenchPreviewRegion) {
  return {
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.width}%`,
    height: `${region.height}%`,
  };
}
