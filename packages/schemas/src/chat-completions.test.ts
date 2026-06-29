import { describe, expect, it } from "vitest";

import { createChatCompletionsJsonSchema } from "./chat-completions";

const messages = [{ role: "user" as const, content: "Hello" }];

describe("chat completions schema", () => {
	it("accepts automatic router mode without an explicit model", () => {
		expect(
			createChatCompletionsJsonSchema.parse({
				model_router_mode: "pro",
				messages,
			}),
		).toMatchObject({
			model_router_mode: "pro",
		});
	});

	it("rejects automatic router mode with an explicit model", () => {
		const result = createChatCompletionsJsonSchema.safeParse({
			model: "gpt-5",
			model_router_mode: "pro",
			messages,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["model_router_mode"],
						message: "model_router_mode is only valid when no explicit model is provided",
					}),
				]),
			);
		}
	});

	it("rejects automatic router mode with explicit multi-model selection", () => {
		const result = createChatCompletionsJsonSchema.safeParse({
			model_router_mode: "pro",
			models: ["gpt-5", "claude-opus"],
			messages,
			use_multi_model: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["model_router_mode"],
						message: "model_router_mode is only valid when no explicit model is provided",
					}),
				]),
			);
		}
	});
});
