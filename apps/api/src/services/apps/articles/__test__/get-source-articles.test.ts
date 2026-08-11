import { describe, expect, it, vi } from "vitest";

import { getSourceArticles } from "../get-source-articles";
import { articleContext, outputRecord } from "./fixtures";

describe("getSourceArticles", () => {
	it("returns only canonical outputs found in the requested personal scope", async () => {
		const outputs = {
			getPersonalOutput: vi
				.fn()
				.mockResolvedValueOnce(
					outputRecord({ id: "analysis-1", content: '{"originalArticle":"A"}' }),
				)
				.mockResolvedValueOnce(null),
		};

		const result = await getSourceArticles({
			context: articleContext(outputs),
			ids: ["analysis-1", "missing"],
			userId: 123,
		});

		expect(result.articles).toHaveLength(1);
		expect(result.articles[0]).toMatchObject({
			id: "analysis-1",
			content: { originalArticle: "A" },
		});
	});

	it("uses project-scoped lookup for collaborative reports", async () => {
		const outputs = { getProjectOutput: vi.fn().mockResolvedValue(null) };

		await getSourceArticles({
			context: articleContext(outputs),
			ids: ["analysis-1"],
			userId: 123,
			projectId: "project-1",
		});

		expect(outputs.getProjectOutput).toHaveBeenCalledWith("project-1", "analysis-1");
	});
});
