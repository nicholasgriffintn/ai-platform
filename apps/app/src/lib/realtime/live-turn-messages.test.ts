import { describe, expect, it } from "vitest";

import type { Message } from "~/types";
import { createTemporaryLiveTitle } from "./live-turn-messages";

describe("createTemporaryLiveTitle", () => {
	it("uses shared message text extraction including parts fallback", () => {
		const message: Message = {
			id: "message-1",
			role: "user",
			content: "",
			parts: [
				{
					type: "text",
					text: "Title from message parts",
				},
			],
		};

		expect(createTemporaryLiveTitle(message)).toBe("Title from message parts");
	});
});
