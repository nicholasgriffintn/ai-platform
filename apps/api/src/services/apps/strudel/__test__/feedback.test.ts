import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { submitStrudelFeedback } from "../feedback";

describe("submitStrudelFeedback", () => {
	it("only updates a generation owned by the authenticated user", async () => {
		const findMany = vi.fn().mockResolvedValue([{ id: "example-1" }]);
		const updateById = vi.fn().mockResolvedValue(true);
		const context = {
			repositories: { trainingExamples: { findMany, updateById } },
		} as unknown as ServiceContext;

		await submitStrudelFeedback({
			context,
			userId: 42,
			generationId: "generation-1",
			score: 5,
		});

		expect(findMany).toHaveBeenCalledWith({
			userId: 42,
			conversationId: "generation-1",
			source: "app",
			appName: "strudel",
			limit: 1,
		});
		expect(updateById).toHaveBeenCalledWith("example-1", { feedback_rating: 5 });
	});

	it("does not mutate an unknown or another user's generation", async () => {
		const updateById = vi.fn();
		const context = {
			repositories: {
				trainingExamples: { findMany: vi.fn().mockResolvedValue([]), updateById },
			},
		} as unknown as ServiceContext;

		await expect(
			submitStrudelFeedback({
				context,
				userId: 42,
				generationId: "generation-other-user",
				feedback: "Incorrect",
			}),
		).rejects.toMatchObject({ type: "NOT_FOUND" });
		expect(updateById).not.toHaveBeenCalled();
	});
});
