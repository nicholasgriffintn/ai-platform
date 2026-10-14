import {
  workAttentionQuerySchema,
  type WorkAttentionItem,
  type WorkAttentionQuery,
} from "@ngriffin_uk/polychat-schemas";
import type { WorkAttentionFilters } from "@ngriffin_uk/polychat-utility-react";

import { getProjectConversationPath } from "./conversation-route.js";

const DEFAULT_LIMIT = 25;

export function readWorkAttentionQuery(searchParams: URLSearchParams): WorkAttentionQuery {
  const candidate = Object.fromEntries(
    Array.from(searchParams.entries()).filter(([, value]) => value.trim().length > 0),
  );
  const parsed = workAttentionQuerySchema.safeParse(candidate);

  return parsed.success ? parsed.data : { limit: DEFAULT_LIMIT };
}

export function workAttentionFiltersOf(query: WorkAttentionQuery): WorkAttentionFilters {
  return {
    kind: query.kind,
    workspaceId: query.workspace_id,
    projectId: query.project_id,
    ownerUserId: query.owner_user_id,
    type: query.type,
    from: query.from,
    to: query.to,
  };
}

export function writeWorkAttentionFilters(
  filters: WorkAttentionFilters,
  limit = DEFAULT_LIMIT,
): URLSearchParams {
  const search = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ["kind", filters.kind],
    ["workspace_id", filters.workspaceId],
    ["project_id", filters.projectId],
    ["owner_user_id", filters.ownerUserId],
    ["type", filters.type],
    ["from", filters.from],
    ["to", filters.to],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  if (limit !== DEFAULT_LIMIT) {
    search.set("limit", String(limit));
  }

  return search;
}

export function workAttentionItemHref(item: WorkAttentionItem): string {
  const projectPath = `/work/${encodeURIComponent(item.workspaceId)}/projects/${encodeURIComponent(item.projectId)}`;

  if (item.type === "task") {
    return `${projectPath}/tasks/${encodeURIComponent(item.resourceId)}`;
  }

  return item.conversationId
    ? getProjectConversationPath(item.workspaceId, item.projectId, item.conversationId)
    : `${projectPath}/activity`;
}
