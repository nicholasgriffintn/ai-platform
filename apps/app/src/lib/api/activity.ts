import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type { ActivityRecord, ActivityStatus } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

export async function listActivity(
  filters: {
    projectId?: string;
    conversationId?: string;
    capabilityId?: string;
    status?: ActivityStatus;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ activities: ActivityRecord[]; hasMore: boolean }> {
  const query = new URLSearchParams();

  if (filters.projectId) {
    query.set("projectId", filters.projectId);
  }

  if (filters.conversationId) {
    query.set("conversationId", filters.conversationId);
  }

  if (filters.capabilityId) {
    query.set("capabilityId", filters.capabilityId);
  }

  if (filters.status) {
    query.set("status", filters.status);
  }

  if (filters.limit !== undefined) {
    query.set("limit", String(filters.limit));
  }

  if (filters.offset !== undefined) {
    query.set("offset", String(filters.offset));
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetchApiOrThrow(`/activity${suffix}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<{ activities: ActivityRecord[]; hasMore: boolean }>(response);
}
