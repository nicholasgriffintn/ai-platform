import { describe, expect, it } from "vitest";

import { HOME_CHAT_MODE_OPTIONS, resolveHomeChatModeId } from "./chatModes";

describe("home chat modes", () => {
	it("resolves supported URL modes", () => {
		expect(resolveHomeChatModeId("council")).toBe("council");
		expect(resolveHomeChatModeId(null)).toBe("chat");
		expect(resolveHomeChatModeId("unknown")).toBe("chat");
	});

	it("keeps sandbox visible but unavailable until it is wired into home chat", () => {
		const sandbox = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "sandbox");

		expect(resolveHomeChatModeId("sandbox")).toBe("chat");
		expect(sandbox?.disabled).toBe(true);
	});
});
