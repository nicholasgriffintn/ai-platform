import { isoDaysBefore } from "@ngriffin_uk/polychat-utility-core";

import { first, items, lines, joinParts } from "./read";
import type { DiscoverSignal } from "./types";

export const WORK_SIGNALS: readonly DiscoverSignal[] = [
  {
    id: "linear-assigned",
    providerId: "linear",
    group: "work",
    title: "Linear",
    description: "Reads the unfinished issues assigned to you.",
    operation: "LINEAR_LIST_LINEAR_ISSUES",
    parameters: () => ({ assignee_id: "me", first: 20 }),
    digest: (result) =>
      lines(items(result, ["data", "issues"], ["issues"], ["data", "nodes"]), (issue) =>
        joinParts(
          first(issue, ["identifier"]),
          first(issue, ["title"]),
          first(issue, ["state", "name"], ["state"]),
          first(issue, ["dueDate"]).slice(0, 10),
        ),
      ),
  },
  {
    id: "github-notifications",
    providerId: "github",
    group: "work",
    title: "GitHub",
    description: "Reads the notifications waiting for you.",
    operation: "GITHUB_LIST_NOTIFICATIONS",
    parameters: ({ now }) => ({ since: isoDaysBefore(now, 2), per_page: 20, participating: true }),
    digest: (result) =>
      lines(items(result, ["data", "details"], ["data", "items"], ["data"]), (notification) =>
        joinParts(
          first(notification, ["repository", "full_name"]),
          first(notification, ["subject", "type"]),
          first(notification, ["subject", "title"]),
        ),
      ),
  },
  {
    id: "fathom-meetings",
    providerId: "fathom",
    group: "work",
    title: "Fathom",
    description: "Reads yesterday's meeting summaries and action items.",
    operation: "FATHOM_LIST_MEETINGS",
    parameters: ({ now }) => ({ created_after: isoDaysBefore(now, 2), include_action_items: true }),
    digest: (result) =>
      lines(items(result, ["data", "items"], ["items"], ["data", "meetings"]), (meeting) =>
        joinParts(
          first(meeting, ["created_at"], ["recording_start_time"]).slice(0, 10),
          first(meeting, ["title"], ["meeting_title"]),
          first(meeting, ["action_items", 0, "description"]).slice(0, 120),
        ),
      ),
  },
  {
    id: "wakatime-week",
    providerId: "wakatime",
    group: "work",
    title: "WakaTime",
    description: "Reads how your coding week has gone.",
    operation: "WAKATIME_GET_USER_SUMMARIES",
    parameters: () => ({ user: "current", range: "last_7_days" }),
    digest: (result) =>
      lines(items(result, ["data", "data"], ["data"]), (day) =>
        joinParts(
          first(day, ["range", "date"]),
          first(day, ["grand_total", "text"]),
          first(day, ["projects", 0, "name"]),
        ),
      ),
  },
];
