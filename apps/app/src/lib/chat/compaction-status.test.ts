import { describe, expect, it } from "vitest";

import {
	getCompactionMessageLabel,
	isCompactionLoadingMessage,
	isCompactionMarkerMessage,
	readCompactionStatusMessage,
} from "./compaction-status";

describe("readCompactionStatusMessage", () => {
	it("detects manual and automatic compaction loading text", () => {
		expect(isCompactionLoadingMessage("Compacting context")).toBe(true);
		expect(isCompactionLoadingMessage("Automatically compacting context")).toBe(true);
		expect(isCompactionLoadingMessage("Generating response...")).toBe(false);
	});

	it("does not label malformed assistant-shaped compaction metadata as a display marker", () => {
		expect(
			getCompactionMessageLabel({
				id: "assistant-compaction",
				role: "assistant",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			}),
		).toBeNull();
	});

	it("suppresses assistant-shaped compaction payloads without rendering them as status rows", () => {
		const assistantMessage = {
			id: "assistant-compaction",
			role: "assistant",
			content: "Ordinary assistant message",
			parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
		};

		expect(getCompactionMessageLabel(assistantMessage)).toBeNull();
		expect(isCompactionMarkerMessage(assistantMessage)).toBe(true);
		expect(readCompactionStatusMessage(assistantMessage)).toBeNull();
	});

	it("does not label role-only compaction metadata as a display marker", () => {
		expect(
			getCompactionMessageLabel({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			}),
		).toBeNull();
	});

	it("preserves durable marker metadata from compaction state payloads", () => {
		expect(
			readCompactionStatusMessage({
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
						type: "compaction",
						status: "completed",
						label: "Context automatically compacted",
						timestamp: 1234,
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
					type: "compaction",
					status: "completed",
					label: "Context automatically compacted",
					timestamp: 1234,
				},
			],
		});
	});

	it("uses the compaction part label when a marker has no content", () => {
		expect(
			readCompactionStatusMessage({
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

	it("prefers completed compaction labels over pending labels", () => {
		expect(
			getCompactionMessageLabel({
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
		).toBe("Context automatically compacted");
	});

	it("preserves compaction marker metadata used by streamed state payloads", () => {
		expect(
			readCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "",
				mode: "recipe",
				usage: {
					prompt_tokens: 12,
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
		).toMatchObject({
			id: "snapshot-1-compaction",
			role: "compaction",
			content: "Context automatically compacted",
			mode: "recipe",
			usage: {
				prompt_tokens: 12,
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

	it("rejects compaction markers with invalid part statuses", () => {
		expect(
			readCompactionStatusMessage({
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
		).toBeNull();
	});

	it("rejects compaction markers with missing part statuses", () => {
		expect(
			readCompactionStatusMessage({
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
		).toBeNull();
	});

	it("rejects role-only compaction markers without compaction parts", () => {
		expect(
			readCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			}),
		).toBeNull();
	});
});
