import { describe, expect, it } from "vitest";
import type { SourceStatus, SourceSummary } from "@assistant/schemas";

import { getProjectConversationSourceIds } from "./project-context";

function createSource(id: string, status: SourceStatus = "available"): SourceSummary {
	return {
		id,
		createdByUserId: 42,
		projectId: "project-1",
		conversationId: null,
		connectionId: null,
		kind: "text",
		title: id,
		status,
		provider: null,
		externalUri: null,
		vectorId: null,
		metadata: {},
		file: null,
		createdAt: "2026-08-11T00:00:00.000Z",
		updatedAt: null,
	};
}

describe("getProjectConversationSourceIds", () => {
	it("combines available project memories and context without duplicate attachments", () => {
		expect(
			getProjectConversationSourceIds(
				[createSource("memory-1"), createSource("processing-memory", "processing")],
				[createSource("source-1"), createSource("memory-1")],
			),
		).toEqual(["memory-1", "source-1"]);
	});
});
