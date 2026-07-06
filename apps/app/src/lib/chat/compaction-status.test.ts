import { describe, expect, it } from "vitest";

import {
	getCompactionMessageLabel,
	isCompactionMarkerMessage,
	readCompactionStatusMessage,
} from "./compaction-status";

describe("readCompactionStatusMessage", () => {
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

	it("rejects malformed compaction metadata instead of creating a visible marker", () => {
		expect(
			readCompactionStatusMessage({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "unknown", label: "Context compacted" }],
			}),
		).toBeNull();
		expect(
			getCompactionMessageLabel({
				id: "snapshot-1-compaction",
				role: "compaction",
				content: "Context compacted",
			}),
		).toBeNull();
	});
});
