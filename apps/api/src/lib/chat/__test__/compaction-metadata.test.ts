import { describe, expect, it } from "vitest";

import { buildChatCompactionMetadata } from "../compaction-metadata";

describe("buildChatCompactionMetadata", () => {
	it("wraps persisted compaction status messages", () => {
		const message = {
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
		};

		expect(buildChatCompactionMetadata(message)).toEqual({
			message,
		});
	});

	it("wraps compaction status messages represented by parts without content", () => {
		expect(
			buildChatCompactionMetadata({
				id: "snapshot-1-compaction",
				role: "compaction",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			}),
		).toMatchObject({
			message: {
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
			},
		});
	});

	it("preserves string mode and platform metadata from compaction markers", () => {
		expect(
			buildChatCompactionMetadata({
				id: "snapshot-1-compaction",
				role: "compaction",
				mode: "recipe",
				platform: "desktop",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			}),
		).toEqual({
			message: {
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context automatically compacted",
				mode: "recipe",
				platform: "desktop",
				parts: [
					{
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
					},
				],
			},
		});
	});

	it("rejects assistant-shaped compaction markers with blank content", () => {
		expect(
			buildChatCompactionMetadata({
				id: "snapshot-1-compaction",
				completion_id: "conversation-1",
				role: "assistant",
				content: "",
				created: 1234,
				provider: "deepseek",
				parts: [
					{
						id: "compaction-part-1",
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
		).toBeUndefined();
	});

	it("rejects compaction markers with invalid part statuses", () => {
		expect(
			buildChatCompactionMetadata({
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

	it("rejects role-only compaction markers without compaction parts", () => {
		expect(
			buildChatCompactionMetadata({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			}),
		).toBeUndefined();
	});

	it("rejects ordinary assistant messages", () => {
		expect(
			buildChatCompactionMetadata({
				id: "assistant-1",
				role: "assistant",
				content: "Hello",
				parts: [{ type: "text", text: "Hello" }],
			}),
		).toBeUndefined();
	});
});
