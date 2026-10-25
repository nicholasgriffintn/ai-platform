import type {
  MobileNotificationCategory,
  MobileWorkNotificationKind,
  MobileWorkNotificationTarget,
} from "@ngriffin_uk/polychat-schemas";

export interface MobileAlertPresentation {
  category: MobileNotificationCategory;
  threadId: string;
  timeSensitive: boolean;
}

export const POLY_ALERT_PRESENTATION: MobileAlertPresentation = {
  category: "poly.update",
  threadId: "poly",
  timeSensitive: false,
};

function workCategory(
  kind: MobileWorkNotificationKind,
  target: MobileWorkNotificationTarget,
): MobileNotificationCategory {
  if (!target.taskId || !target.interactionId) {
    return "work.update";
  }

  if (kind === "approval") {
    return "work.approval";
  }

  return kind === "input" ? "work.input" : "work.update";
}

export function workAlertPresentation(
  kind: MobileWorkNotificationKind,
  target: MobileWorkNotificationTarget,
): MobileAlertPresentation {
  return {
    category: workCategory(kind, target),
    threadId: `project:${target.projectId}`,
    timeSensitive: kind === "approval" || kind === "input",
  };
}
