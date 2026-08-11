import { describe, expect, it, vi } from "vitest";

import { listArticles } from "../list";
import { articleContext, outputRecord } from "./fixtures";

describe("listArticles", () => {
	it("groups canonical outputs into newest-first article sessions", async () => {
		const outputs = {
			listPersonalOutputs: vi.fn().mockResolvedValue([
				outputRecord({ id: "analysis-1", group_id: "older", created_at: "2026-08-10T10:00:00Z" }),
				outputRecord({
					id: "report-1",
					group_id: "newer",
					kind: "report",
					content: JSON.stringify({ title: "Canonical report", sourceItemIds: ["a", "b"] }),
					created_at: "2026-08-11T10:00:00Z",
				}),
			]),
		};

		const result = await listArticles({ context: articleContext(outputs), userId: 123 });

		expect(outputs.listPersonalOutputs).toHaveBeenCalledWith(123, "articles");
		expect(result.sessions).toEqual([
			{
				groupId: "newer",
				id: "report-1",
				title: "Canonical report",
				createdAt: "2026-08-11T10:00:00Z",
				sourceCount: 2,
				status: "complete",
			},
			{
				groupId: "older",
				id: undefined,
				title: "Analysis Session: older",
				createdAt: "2026-08-10T10:00:00Z",
				sourceCount: 0,
				status: "processing",
			},
		]);
	});

	it("uses the project scope without filtering by creator", async () => {
		const outputs = { listProjectOutputs: vi.fn().mockResolvedValue([]) };

		await listArticles({ context: articleContext(outputs), userId: 123, projectId: "project-1" });

		expect(outputs.listProjectOutputs).toHaveBeenCalledWith("project-1", "articles");
	});
});
