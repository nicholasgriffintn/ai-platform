import { describe, expect, it } from "vitest";

import { createChatCompletionsJsonSchema } from "@assistant/schemas";

describe("createChatCompletionsJsonSchema", () => {
	it("preserves caveman_mode on chat completion requests", () => {
		const parsed = createChatCompletionsJsonSchema.parse({
			model: "devstral-medium-2507",
			caveman_mode: {
				enabled: true,
				level: "full",
			},
			messages: [{ role: "user", content: "Hello" }],
		});

		expect(parsed.caveman_mode).toEqual({
			enabled: true,
			level: "full",
		});
	});
});
