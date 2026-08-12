import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ActivityRecord } from "~/repositories/ActivityRepository";
import { listActivity } from "../index";

function createActivity(id: string): ActivityRecord {
	return {
		id,
		created_by_user_id: 42,
		project_id: null,
		conversation_id: null,
		capability_id: "research",
		group_id: null,
		kind: "research_run",
		status: "succeeded",
		summary: `Activity ${id}`,
		data: "{}",
		created_at: "2026-08-12T09:00:00.000Z",
		updated_at: "2026-08-12T09:01:00.000Z",
	};
}

describe("listActivity", () => {
	it("filters and paginates activity in the repository", async () => {
		const listPersonalActivities = vi
			.fn()
			.mockResolvedValue([createActivity("one"), createActivity("two"), createActivity("three")]);
		const context = {
			repositories: { activities: { listPersonalActivities } },
		} as unknown as ServiceContext;

		const result = await listActivity(context, 42, {
			capabilityId: "research",
			status: "succeeded",
			limit: 2,
			offset: 4,
		});

		expect(listPersonalActivities).toHaveBeenCalledWith(42, {
			capabilityId: "research",
			status: "succeeded",
			limit: 3,
			offset: 4,
		});
		expect(result.activities.map((activity) => activity.id)).toEqual(["one", "two"]);
		expect(result.hasMore).toBe(true);
	});
});
