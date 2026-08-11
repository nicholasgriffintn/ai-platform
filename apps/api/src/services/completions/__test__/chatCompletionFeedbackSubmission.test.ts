import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	handleChatCompletionFeedbackSubmission,
	type ChatFeedbackContext,
} from "../chatCompletionFeedbackSubmission";

const patchLog = vi.fn(async () => undefined);
const gateway = vi.fn(() => ({ patchLog }));
const findMany = vi.fn(async () => [{ id: "training-example-1" }]);
const updateById = vi.fn(async () => true);

function createContext(overrides: Partial<ChatFeedbackContext> = {}): ChatFeedbackContext {
	return {
		env: {
			AI_GATEWAY_TOKEN: "gateway-token",
			ACCOUNT_ID: "account-1",
			AI: { gateway },
		},
		user: { email: "person@example.com" },
		repositories: {
			trainingExamples: { findMany, updateById },
		},
		...overrides,
	};
}

describe("handleChatCompletionFeedbackSubmission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		findMany.mockResolvedValue([{ id: "training-example-1" }]);
		updateById.mockResolvedValue(true);
		patchLog.mockResolvedValue(undefined);
	});

	it("records positive feedback at both external and local seams", async () => {
		const result = await handleChatCompletionFeedbackSubmission(createContext(), {
			completion_id: "completion-1",
			request: { log_id: "log-1", feedback: 1, score: 80 },
		});

		expect(gateway).toHaveBeenCalledWith("llm-assistant");
		expect(patchLog).toHaveBeenCalledWith("log-1", {
			feedback: 1,
			score: 80,
			metadata: { user: "person@example.com" },
		});
		expect(findMany).toHaveBeenCalledWith({
			conversationId: "completion-1",
			source: "chat",
			limit: 1,
		});
		expect(updateById).toHaveBeenCalledWith("training-example-1", {
			feedback_rating: 5,
		});
		expect(result).toEqual({
			success: true,
			message: "Feedback submitted successfully",
			completion_id: "completion-1",
		});
	});

	it("records negative feedback locally when the gateway is not configured", async () => {
		const context = createContext({
			env: {
				AI: { gateway },
			},
		});

		await handleChatCompletionFeedbackSubmission(context, {
			completion_id: "completion-2",
			request: { log_id: "log-2", feedback: -1 },
		});

		expect(patchLog).not.toHaveBeenCalled();
		expect(updateById).toHaveBeenCalledWith("training-example-1", {
			feedback_rating: 1,
		});
	});

	it("keeps local feedback when the optional gateway write fails", async () => {
		patchLog.mockRejectedValueOnce(new Error("gateway unavailable"));

		await expect(
			handleChatCompletionFeedbackSubmission(createContext(), {
				completion_id: "completion-3",
				request: { log_id: "log-3", feedback: 1 },
			}),
		).resolves.toMatchObject({ success: true });
		expect(updateById).toHaveBeenCalledWith("training-example-1", {
			feedback_rating: 5,
		});
	});

	it("does not invent a local update when no training example exists", async () => {
		findMany.mockResolvedValueOnce([]);

		await handleChatCompletionFeedbackSubmission(createContext(), {
			completion_id: "completion-4",
			request: { log_id: "log-4", feedback: -1 },
		});

		expect(updateById).not.toHaveBeenCalled();
	});
});
