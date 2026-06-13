import { describe, expect, it } from "vitest";

import { returnSmsPrompt } from "../sms";

describe("sms prompt", () => {
	it("builds compact SMS channel instructions", () => {
		const prompt = returnSmsPrompt({
			messages: [],
			mode: "agent",
			options: {
				sms: {
					enabled: true,
					from: "+15551234567",
					to: "+15557654321",
				},
			},
		} as any);

		expect(prompt).toContain("replying in an SMS conversation");
		expect(prompt).toContain("<sms_context>");
		expect(prompt).toContain("Sender: +15551234567");
		expect(prompt).toContain("Keep replies concise and plain-text");
		expect(prompt).toContain("Do not use markdown tables");
	});
});
