import { describe, expect, it, vi } from "vitest";

import {
	createMemorySurfaceStorage,
	createSurfaceAction,
	createUnavailableSurfaceAction,
	SurfaceCapabilityUnavailableError,
} from "./index";

describe("surface controls", () => {
	it("runs available host actions", async () => {
		const implementation = vi.fn<(value: string) => void>();
		const action = createSurfaceAction(implementation);

		await action.run("hello");

		expect(action.availability).toEqual({ status: "available" });
		expect(implementation).toHaveBeenCalledWith("hello");
	});

	it("fails closed when a host capability is unavailable", async () => {
		const action = createUnavailableSurfaceAction<string>("share", "not supported by this host");

		expect(action.availability).toEqual({
			status: "unavailable",
			reason: "not supported by this host",
		});
		await expect(action.run("content")).rejects.toEqual(
			expect.objectContaining<Partial<SurfaceCapabilityUnavailableError>>({
				name: "SurfaceCapabilityUnavailableError",
				capability: "share",
			}),
		);
	});

	it("provides deterministic storage for hosts and tests", async () => {
		const storage = createMemorySurfaceStorage({ theme: "dark" });
		expect(await storage.get("theme")).toBe("dark");

		await storage.set("theme", "light");
		expect(await storage.get("theme")).toBe("light");

		await storage.remove("theme");
		expect(await storage.get("theme")).toBeNull();
	});
});
