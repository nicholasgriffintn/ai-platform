import type { ActivityRecord, ActivityStatus, ListPage } from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

export function listActivity(
  filters: {
    projectId?: string;
    conversationId?: string;
    capabilityId?: string;
    status?: ActivityStatus;
    limit?: number;
    after?: string;
  } = {},
): Promise<ListPage<ActivityRecord>> {
  return resource<ActivityRecord>("/activity").list({
    project_id: filters.projectId,
    conversation_id: filters.conversationId,
    capability_id: filters.capabilityId,
    status: filters.status,
    limit: filters.limit,
    after: filters.after,
  });
}
