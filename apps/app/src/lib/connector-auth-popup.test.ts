import { describe, expect, it, vi } from "vitest";

import {
	CONNECTOR_AUTH_POPUP_NAME,
	openConnectorAuthPopup,
	waitForConnectorAuthPopup,
} from "./connector-auth-popup";

describe("connector auth popup", () => {
	it("opens a focused, named popup instead of a browser tab", () => {
		const popup = { focus: vi.fn() };
		const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);

		expect(openConnectorAuthPopup()).toBe(popup);
		expect(open).toHaveBeenCalledWith(
			"",
			CONNECTOR_AUTH_POPUP_NAME,
			expect.stringMatching(/popup=yes.*width=520.*height=720/),
		);
		expect(popup.focus).toHaveBeenCalled();
	});

	it("accepts completion only from the exact popup, Polychat origin, and provider", async () => {
		const popup = { closed: false, close: vi.fn() } as unknown as Window;
		const completion = waitForConnectorAuthPopup({ popup, provider: "airtable" });

		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "polychat:connector-auth:completed", provider: "airtable" },
				origin: "https://attacker.example",
				source: popup,
			}),
		);
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "polychat:connector-auth:completed", provider: "gmail" },
				origin: window.location.origin,
				source: popup,
			}),
		);
		window.dispatchEvent(
			new MessageEvent("message", {
				data: { type: "polychat:connector-auth:completed", provider: "airtable" },
				origin: window.location.origin,
				source: popup,
			}),
		);

		await expect(completion).resolves.toBe("connected");
		expect(popup.close).toHaveBeenCalledOnce();
	});

	it("reports when the user closes the popup before completing connection", async () => {
		vi.useFakeTimers();
		const popup = { closed: true, close: vi.fn() } as unknown as Window;
		const completion = waitForConnectorAuthPopup({ popup, provider: "airtable" });

		await vi.advanceTimersByTimeAsync(500);

		await expect(completion).resolves.toBe("closed");
		vi.useRealTimers();
	});
});
