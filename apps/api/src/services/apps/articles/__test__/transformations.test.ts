import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IUser } from "~/types";
import { analyseArticle } from "../analyse";
import { generateArticlesReport } from "../generate-report";
import { summariseArticle } from "../summarise";
import { articleContext, outputRecord } from "./fixtures";

const provider = { getResponse: vi.fn() };

vi.mock("~/lib/chat/utils", () => ({ sanitiseInput: (input: string) => input }));
vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModelForRetrieval: vi.fn().mockResolvedValue({
		model: "test-model",
		provider: "test-provider",
	}),
	findModelConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/lib/providers/capabilities/chat", () => ({ getChatProvider: () => provider }));
vi.mock("~/utils/extract", () => ({ extractQuotes: () => ["quote"] }));
vi.mock("~/utils/verify", () => ({
	verifyQuotes: () => ({ verified: true, missingQuotes: [] }),
}));

const user: IUser = {
	id: 123,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	created_at: "2026-08-11T10:00:00Z",
	updated_at: "2026-08-11T10:00:00Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: "pro",
};

const request = {
	completion_id: "completion-1",
	app_url: "https://api.test",
	args: { article: "Article body", itemId: "session-1" },
	user,
};

describe("article transformations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		provider.getResponse.mockResolvedValue({
			content: "Generated content",
			id: "provider-result-1",
			citations: ["https://example.com"],
			log_id: "log-1",
		});
	});

	it("stores analysis as a canonical output", async () => {
		const outputs = {
			createOutput: vi.fn().mockResolvedValue(outputRecord({ id: "analysis-1" })),
		};

		const result = await analyseArticle({ ...request, context: articleContext(outputs) });

		expect(result.outputId).toBe("analysis-1");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({
				createdByUserId: 123,
				capabilityId: "articles",
				groupId: "session-1",
				kind: "analysis",
			}),
		);
	});

	it("stores summaries as canonical outputs", async () => {
		const outputs = {
			createOutput: vi.fn().mockResolvedValue(outputRecord({ id: "summary-1", kind: "summary" })),
		};

		const result = await summariseArticle({ ...request, context: articleContext(outputs) });

		expect(result.outputId).toBe("summary-1");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({ groupId: "session-1", kind: "summary" }),
		);
	});

	it("builds a report from analysis outputs and stores their output IDs as sources", async () => {
		const outputs = {
			listPersonalOutputGroup: vi.fn().mockResolvedValue([
				outputRecord({ id: "analysis-1", content: '{"originalArticle":"First"}' }),
				outputRecord({
					id: "summary-1",
					kind: "summary",
					content: '{"originalArticle":"Ignored"}',
				}),
			]),
			createOutput: vi.fn().mockResolvedValue(outputRecord({ id: "report-1", kind: "report" })),
		};

		const result = await generateArticlesReport({
			...request,
			context: articleContext(outputs),
			args: { itemId: "session-1" },
		});

		expect(result.outputId).toBe("report-1");
		expect(outputs.createOutput).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "report",
				content: expect.objectContaining({ sourceItemIds: ["analysis-1"] }),
			}),
		);
	});

	it("rejects report generation when the session has no analyses", async () => {
		const outputs = { listPersonalOutputGroup: vi.fn().mockResolvedValue([]) };

		await expect(
			generateArticlesReport({
				...request,
				context: articleContext(outputs),
				args: { itemId: "session-1" },
			}),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});
