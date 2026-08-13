// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("web surface construction", () => {
	it("provides SSR-safe controls and storage", async () => {
		vi.stubGlobal("window", undefined);
		vi.stubGlobal("navigator", undefined);
		vi.resetModules();

		const { webSurfaceControls } = await import("./surface-controls");

		expect(webSurfaceControls.navigate.availability).toEqual({
			status: "unavailable",
			reason: "Navigation requires a browser window",
		});
		expect(webSurfaceControls.copyText.availability.status).toBe("unavailable");
		expect(webSurfaceControls.notify.availability.status).toBe("unavailable");
		expect(webSurfaceControls.share.availability).toEqual({
			status: "unavailable",
			reason: "Sharing is not supported by this browser",
		});

		await webSurfaceControls.storage.set("server-key", "server-value");
		expect(await webSurfaceControls.storage.get("server-key")).toBe("server-value");
		await webSurfaceControls.storage.remove("server-key");
		expect(await webSurfaceControls.storage.get("server-key")).toBeNull();
	});
});
