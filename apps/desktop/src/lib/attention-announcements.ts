import type { WorkAttentionItem } from "@ngriffin_uk/polychat-schemas";

export interface DesktopAnnouncement {
  id: string;
  title: string;
  body: string;
}

const ANNOUNCED_KINDS = new Set(["approval", "input", "review", "failed"]);

const KIND_TITLES: Record<string, string> = {
  approval: "Waiting on your approval",
  input: "Waiting on your input",
  review: "Waiting on your review",
  failed: "Something failed",
};

export function isWorthAnnouncing(item: WorkAttentionItem): boolean {
  return item.isUnread && ANNOUNCED_KINDS.has(item.kind);
}

export function describeAttentionItem(item: WorkAttentionItem): DesktopAnnouncement {
  return {
    id: item.id,
    title: KIND_TITLES[item.kind] ?? "Waiting on you",
    body: `${item.title} — ${item.projectName}`,
  };
}

export function readAnnouncements(items: readonly WorkAttentionItem[]): DesktopAnnouncement[] {
  return items.filter(isWorthAnnouncing).map(describeAttentionItem);
}
