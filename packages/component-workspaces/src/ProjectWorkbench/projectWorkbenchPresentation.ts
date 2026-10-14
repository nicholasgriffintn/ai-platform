import type {
  ProjectWorkbenchPane,
  ProjectWorkbenchStatus,
} from "@ngriffin_uk/polychat-utility-react";
import {
  Activity,
  Bot,
  FileDiff,
  Files,
  FileText,
  MonitorPlay,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const PANE_PRESENTATION: Record<ProjectWorkbenchPane, { label: string; icon: LucideIcon }> =
  {
    artifact: { label: "Artifact", icon: FileText },
    activity: { label: "Activity", icon: Activity },
    preview: { label: "Preview", icon: MonitorPlay },
    changes: { label: "Changes", icon: FileDiff },
    files: { label: "Files", icon: Files },
    proof: { label: "Proof", icon: ShieldCheck },
    delegates: { label: "Delegates", icon: Bot },
  };

export const FLUSH_PANES: readonly ProjectWorkbenchPane[] = ["artifact"];

export const STATUS_PRESENTATION: Record<
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
