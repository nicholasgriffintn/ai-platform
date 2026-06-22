import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	extractContent: vi.fn(),
	getAuxiliaryModelForRetrieval: vi.fn(),
	getChatProvider: vi.fn(),
	getResponse: vi.fn(),
}));

vi.mock("~/services/apps/retrieval/content-extract", () => ({
	extractContent: mocks.extractContent,
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModelForRetrieval: mocks.getAuxiliaryModelForRetrieval,
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: mocks.getChatProvider,
}));

import { extract_content } from "../extract_content";
import type { IRequest } from "~/types";

const user = {
	id: 42,
	plan_id: "pro",
	email: "user@example.com",
} as any;

const request: IRequest = {
	app_url: "https://app.example.com",
	env: { AI: {} } as any,
	user,
};

const toolContext = {
	appUrl: "https://app.example.com",
	completionId: "completion-id",
	env: request.env,
	user,
	request,
};

describe("extract_content function", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.extractContent.mockResolvedValue({
			status: "success",
			data: {
				extracted: {
					results: [
						{
							url: "https://example.com/article",
							raw_content: "Article body",
						},
					],
				},
			},
		});
		mocks.getAuxiliaryModelForRetrieval.mockResolvedValue({
			model: "retrieval-aux-model",
			provider: "workers-ai",
		});
		mocks.getResponse.mockResolvedValue({
			response: "Summary from auxiliary model",
		});
		mocks.getChatProvider.mockReturnValue({
			getResponse: mocks.getResponse,
		});
	});

	it("summarises extracted content with the retrieval auxiliary model", async () => {
		const result = await extract_content.execute(
			{ urls: "https://example.com/article" },
			toolContext as any,
		);

		expect(mocks.getAuxiliaryModelForRetrieval).toHaveBeenCalledWith(request.env, user);
		expect(mocks.getChatProvider).toHaveBeenCalledWith("workers-ai", {
			env: request.env,
			user,
		});
		expect(mocks.getResponse).toHaveBeenCalledWith(
			expect.objectContaining({
				app_url: "https://app.example.com",
				completion_id: "completion-id",
				env: request.env,
				model: "retrieval-aux-model",
				user,
			}),
		);
		expect(result).toEqual(
			expect.objectContaining({
				status: "success",
				content: "Summary from auxiliary model",
				data: expect.objectContaining({
					summary: "Summary from auxiliary model",
				}),
			}),
		);
	});
});
