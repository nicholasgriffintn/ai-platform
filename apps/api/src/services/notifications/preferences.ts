import type {
  MobileWorkNotificationKind,
  TaskNotificationCategory,
  TaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";

const MOBILE_KIND_CATEGORY: Record<MobileWorkNotificationKind, TaskNotificationCategory> = {
  assigned: "assignments",
  input: "decisions",
  approval: "decisions",
  review: "decisions",
  completed: "completions",
  failed: "failures",
};

export function isTaskNotificationPreferenceEnabled(
  preferences: TaskNotificationPreferences,
  category: TaskNotificationCategory,
): boolean {
  return preferences.enabled && preferences[category];
}

export function notificationCategoryForMobileKind(
  kind: MobileWorkNotificationKind,
): TaskNotificationCategory {
  return MOBILE_KIND_CATEGORY[kind];
}
