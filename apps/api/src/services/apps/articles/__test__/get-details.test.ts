import { describe, expect, it, vi } from "vitest";

import { getArticleDetails } from "../get-details";
import { articleContext, outputRecord } from "./fixtures";

describe("getArticleDetails", () => {
	it("returns the canonical output contract with parsed content", async () => {
		const outputs = {
			getPersonalOutput: vi.fn().mockResolvedValue(
				outputRecord({
					id: "report-1",
					kind: "report",
					content: JSON.stringify({ title: "Report" }),
				}),
			),
		};

		const result = await getArticleDetails({
			context: articleContext(outputs),
			id: "report-1",
			userId: 123,
		});

		expect(result.article).toMatchObject({
			id: "report-1",
			createdByUserId: 123,
			capabilityId: "articles",
			groupId: "session-1",
			kind: "report",
			content: { title: "Report" },
		});
	});

	it("does not return another user's missing personal output", async () => {
		const outputs = { getPersonalOutput: vi.fn().mockResolvedValue(null) };

		await expect(
			getArticleDetails({
				context: articleContext(outputs),
				id: "missing",
				userId: 123,
			}),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});
