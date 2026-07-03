import { describe, expect, it } from "vitest";

import { normaliseCompactionStatusMessage } from "./compaction-status";

describe("normaliseCompactionStatusMessage", () => {
	it("normalises durable compaction markers", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				completion_id: "conversation-1",
				role: "compaction",
				content: "Context automatically compacted",
				created: 1234,
				timestamp: 1234,
				model: "deepseek-v4-flash",
				provider: "deepseek",
				platform: "web",
				log_id: "log-1",
				status: "completed",
				data: {
					source: "automatic-compaction",
				},
				parts: [
					{
						id: "part-1",
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
						timestamp: 1234,
						metadata: {
							source: "automatic-compaction",
						},
					},
				],
			}),
		).toEqual({
			id: "snapshot-1-compaction",
			completion_id: "conversation-1",
			role: "compaction",
			content: "Context automatically compacted",
			created: 1234,
			timestamp: 1234,
			model: "deepseek-v4-flash",
			provider: "deepseek",
			platform: "web",
			log_id: "log-1",
			status: "completed",
			data: {
				source: "automatic-compaction",
			},
			parts: [
				{
					id: "part-1",
					type: "compaction",
					status: "completed",
					label: "Context automatically compacted",
					timestamp: 1234,
					metadata: {
						source: "automatic-compaction",
					},
				},
			],
		});
	});

	it("uses the completed compaction part label when marker content is blank", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "",
				parts: [
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
			parts: [
				{
					type: "compaction",
					status: "completed",
					label: "Context automatically compacted",
				},
			],
		});
	});

	it("prefers completed labels over pending labels when marker content is blank", () => {
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
			content: "Context automatically compacted",
		});
	});

	it("rejects pending compaction markers as durable status messages", () => {
		expect(
			normaliseCompactionStatusMessage({
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
			}),
		).toBeUndefined();
	});

	it("drops non-finite numeric metadata from durable compaction markers", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
				created: Number.NaN,
				timestamp: Number.POSITIVE_INFINITY,
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			}),
		).toEqual({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context compacted",
			parts: [
				{
					type: "compaction",
					status: "completed",
					label: "Context compacted",
				},
			],
		});
	});

	it("rejects assistant-shaped messages with compaction parts", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "assistant-compaction",
				role: "assistant",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			}),
		).toBeUndefined();
	});

	it("rejects compaction markers with invalid part statuses", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Automatically compacting context",
				parts: [
					{
						type: "compaction",
						status: "unknown",
						label: "Automatically compacting context",
					},
				],
			}),
		).toBeUndefined();
	});

	it("rejects compaction markers with missing part statuses", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						label: "Context compacted",
					},
				],
			}),
		).toBeUndefined();
	});

	it("rejects role-only compaction markers without compaction parts", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			}),
		).toBeUndefined();
	});

	it("rejects user-shaped messages with compaction parts", () => {
		expect(
			normaliseCompactionStatusMessage({
				id: "user-1",
				role: "user",
				content: "Context compacted",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context compacted",
					},
				],
			}),
		).toBeUndefined();
	});
});
