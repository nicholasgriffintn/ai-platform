import { describe, expect, it } from "vitest";

import { webSurfaceControls } from "./surface-controls";

describe("webSurfaceControls", () => {
	it("describes host capabilities before renderers use them", () => {
		expect(webSurfaceControls.navigate.availability.status).toBe("available");
		expect(webSurfaceControls.openExternal.availability.status).toBe("available");
		expect(webSurfaceControls.copyText.availability).toEqual({
			status: "unavailable",
			reason: "Clipboard access is not supported by this host",
		});
		expect(webSurfaceControls.selectFiles.availability).toEqual({
			status: "unavailable",
			reason: "Use a controlled file input in the web renderer",
		});
	});

	it("uses the host storage adapter", async () => {
		await webSurfaceControls.storage.set("surface-test", "value");
		expect(await webSurfaceControls.storage.get("surface-test")).toBe("value");
		await webSurfaceControls.storage.remove("surface-test");
		expect(await webSurfaceControls.storage.get("surface-test")).toBeNull();
	});

	it.each([
		"javascript:alert(1)",
		"//attacker.example/path",
		"/\\attacker.example/path",
		"https://attacker.example/path",
	])("rejects unsafe same-tab navigation intent %s", async (href) => {
		await expect(webSurfaceControls.navigate.run({ href })).rejects.toThrow(
			"navigation path is unsafe",
		);
	});

	it.each(["javascript:alert(1)", "//attacker.example/path", "http://attacker.example/path"])(
		"rejects unsafe external URL %s",
		async (url) => {
			await expect(webSurfaceControls.openExternal.run(url)).rejects.toThrow(
				"external URL is unsafe",
			);
		},
	);
});
