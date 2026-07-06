import { describe, expect, it } from "vitest";

import { normaliseCompactionStatusMessage } from "./compaction-status";

describe("normaliseCompactionStatusMessage", () => {
	it("uses the completed compaction part label when marker content is blank", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "",
				parts: [
					{
						type: "compaction",
						status: "pending",
						label: "Automatically compacting context",
					},
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			}),
		).toMatchObject({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context automatically compacted",
		});
	});

	it("rejects pending, malformed, and role-only markers as durable status messages", () => {
		for (const message of [
			{
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Automatically compacting context",
				parts: [
					{
						type: "compaction",
						status: "pending",
						label: "Automatically compacting context",
					},
				],
			},
			{
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "unknown",
						label: "Context compacted",
					},
				],
			},
			{
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			},
		]) {
			expect(normaliseCompactionStatusMessage(message)).toBeUndefined();
		}
	});
});
