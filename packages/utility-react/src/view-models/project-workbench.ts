import type {
  SandboxPreviewAccess,
  SandboxPreviewState,
  SandboxServiceStatus,
} from "@ngriffin_uk/polychat-schemas";

export const PROJECT_WORKBENCH_PANES = [
  "context",
  "artifact",
  "activity",
  "preview",
  "changes",
  "files",
  "proof",
  "delegates",
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
