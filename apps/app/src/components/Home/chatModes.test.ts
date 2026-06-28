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
		expect(resolveHomeChatModeId("sandbox")).toBe("sandbox");
		expect(resolveHomeChatModeId("live")).toBe("live");
		expect(resolveHomeChatModeId("sms")).toBe("chat");
		expect(resolveHomeChatModeId(null)).toBe("chat");
		expect(resolveHomeChatModeId("unknown")).toBe("chat");
	});

	it("keeps sandbox selectable from the shared mode switcher", () => {
		const sandbox = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "sandbox");

		expect(sandbox?.disabled).toBeUndefined();
	});

	it("prevents mutually exclusive modes from being enabled together", () => {
		const council = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "council");
		const background = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "background");
		const sandbox = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "sandbox");
		const live = HOME_CHAT_MODE_OPTIONS.find((option) => option.id === "live");

		expect(council).toBeDefined();
		expect(background).toBeDefined();
		expect(sandbox).toBeDefined();
		expect(live).toBeDefined();
		expect(getHomeChatModeAvailability(background!, "council").disabled).toBe(true);
		expect(getHomeChatModeAvailability(sandbox!, "background").disabled).toBe(true);
		expect(getHomeChatModeAvailability(sandbox!, "council").disabled).toBe(true);
		expect(getHomeChatModeAvailability(council!, "sandbox").disabled).toBe(true);
		expect(getHomeChatModeAvailability(live!, "sandbox").disabled).toBe(true);
		expect(getHomeChatModeAvailability(council!, "live").disabled).toBe(true);
		expect(getHomeChatModeAvailability(sandbox!, "chat").disabled).toBe(false);
	});
});
