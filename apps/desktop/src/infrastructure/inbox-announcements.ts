import {
  isTaskNotificationCategoryEnabled,
  taskNotificationCategoryForAttentionKind,
  type ProjectTaskAttentionItem,
  type TaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";

export interface DesktopAnnouncement {
  id: string;
  title: string;
  body: string;
}

const KIND_TITLES: Record<ProjectTaskAttentionItem["kind"], string> = {
  approval: "Waiting on your approval",
  input: "Waiting on your input",
  review: "Waiting on your review",
  blocked: "A task is blocked",
  assigned: "A task is yours",
  completion: "A task finished",
};

export function describeInboxItem(item: ProjectTaskAttentionItem): DesktopAnnouncement {
  return {
    id: item.id,
    title: KIND_TITLES[item.kind],
    body: `${item.objective} — ${item.projectName}`,
  };
}

export function readAttentionBadgeCount(
  unread: number,
  preferences: TaskNotificationPreferences | undefined,
): number {
  return preferences?.enabled ? unread : 0;
}

export function readAnnouncementSignature(
  scope: string,
  announcements: readonly DesktopAnnouncement[],
): string {
  return [scope, ...announcements.map((announcement) => announcement.id)].join(" ");
}

export function readAnnouncements(
  items: readonly ProjectTaskAttentionItem[],
  preferences: TaskNotificationPreferences | undefined,
): DesktopAnnouncement[] {
  if (!preferences) {
    return [];
  }

  return items
    .filter(
      (item) =>
        !item.isRead &&
        isTaskNotificationCategoryEnabled(
          preferences,
          taskNotificationCategoryForAttentionKind(item.kind),
        ),
    )
    .map(describeInboxItem);
}
