const INBOX_PAGE_VIEWS = ["needs", "updates", "mine"] as const;

export type InboxPageView = (typeof INBOX_PAGE_VIEWS)[number];

export function readInboxView(value: string | null): InboxPageView {
  return INBOX_PAGE_VIEWS.find((view) => view === value) ?? "needs";
}
