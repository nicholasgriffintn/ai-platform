import { describe, expect, it } from "vitest";

import { listConfigurableChatProviders } from "../chat";

describe("chat provider capabilities", () => {
	it("retains the configured Perplexity provider id", () => {
		const providers = listConfigurableChatProviders();

		expect(providers).toContain("perplexity-ai");
		expect(providers).not.toContain("perplexity");
	});
});
