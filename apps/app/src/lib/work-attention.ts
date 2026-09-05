import type { WorkAttentionFilters } from "@ngriffin_uk/polychat-component-workspaces";
import {
  workAttentionQuerySchema,
  type WorkAttentionItem,
  type WorkAttentionQuery,
} from "@ngriffin_uk/polychat-schemas";

const DEFAULT_LIMIT = 25;

export function readWorkAttentionQuery(searchParams: URLSearchParams): WorkAttentionQuery {
  const candidate = Object.fromEntries(
    Array.from(searchParams.entries()).filter(([, value]) => value.trim().length > 0),
  );
  const parsed = workAttentionQuerySchema.safeParse(candidate);

  return parsed.success ? parsed.data : { limit: DEFAULT_LIMIT, offset: 0 };
}

export function writeWorkAttentionFilters(
  filters: WorkAttentionFilters,
  limit = DEFAULT_LIMIT,
  offset = 0,
): URLSearchParams {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  if (limit !== DEFAULT_LIMIT) {
    search.set("limit", String(limit));
  }

  if (offset > 0) {
    search.set("offset", String(offset));
  }

  return search;
}

export function workAttentionItemHref(item: WorkAttentionItem): string {
  const projectPath = `/work/${encodeURIComponent(item.workspaceId)}/projects/${encodeURIComponent(item.projectId)}`;

  if (item.type === "task") {
    return `${projectPath}/tasks/${encodeURIComponent(item.resourceId)}`;
  }

  return item.conversationId
    ? `${projectPath}/chat?completion_id=${encodeURIComponent(item.conversationId)}`
    : `${projectPath}/activity`;
}
