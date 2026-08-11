import type { ActivityRecord, ActivityStatus } from "@assistant/schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";

export async function listActivity(
	filters: {
		projectId?: string;
		capabilityId?: string;
		status?: ActivityStatus;
	} = {},
): Promise<ActivityRecord[]> {
	const query = new URLSearchParams();
	if (filters.projectId) query.set("projectId", filters.projectId);
	if (filters.capabilityId) query.set("capabilityId", filters.capabilityId);
	if (filters.status) query.set("status", filters.status);
	const suffix = query.size ? `?${query.toString()}` : "";
	const response = await fetchApiOrThrow(`/activity${suffix}`, {
		method: "GET",
		headers: await apiService.getHeaders(),
	});
	return (await returnFetchedData<{ activities: ActivityRecord[] }>(response)).activities;
}
