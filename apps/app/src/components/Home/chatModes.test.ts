import { describe, expect, it } from "vitest";

import {
	HOME_CHAT_MODE_OPTIONS,
	getHomeChatModeAvailability,
	resolveHomeChatModeId,
} from "./chatModes";

describe("home chat modes", () => {
	it("resolves supported URL modes", () => {
		expect(resolveHomeChatModeId("background")).toBe("background");
		expect(resolveHomeChatModeId("council")).toBe("council");
		expect(resolveHomeChatModeId("live")).toBe("live");
		expect(resolveHomeChatModeId("sms")).toBe("chat");
		expect(resolveHomeChatModeId(null)).toBe("chat");
		expect(resolveHomeChatModeId("unknown")).toBe("chat");
	});

	it("prevents mutually exclusive modes from being enabled together", () => {
		const council = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "council");
		const background = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "background");
		const live = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "live");

		expect(council).toBeDefined();
		expect(background).toBeDefined();
		expect(live).toBeDefined();
		expect(getHomeChatModeAvailability(background!, "council").disabled).toBe(true);
		expect(getHomeChatModeAvailability(council!, "live").disabled).toBe(true);
	});
});
