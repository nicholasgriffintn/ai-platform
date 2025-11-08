import { describe, expect, it, vi } from "vitest";

import { ProviderRegistry } from "~/lib/providers/registry/ProviderRegistry";
import { ProviderLibrary } from "~/lib/providers/library";

const buildLibrary = () => {
	const registry = new ProviderRegistry();
	const audioBootstrapper = vi.fn((reg: ProviderRegistry) => {
		if (!reg.list("audio").some((provider) => provider.name === "mock-audio")) {
			reg.register("audio", {
				name: "mock-audio",
				create: () => ({ id: "audio" }) as any,
			});
		}
	});

	const bootstrappers = { audio: [audioBootstrapper] } as any;

	// @ts-expect-error - constructor is intentionally private, safe for tests
	const library = new ProviderLibrary(registry, bootstrappers);

	return { library, registry, audioBootstrapper };
};

describe("ProviderLibrary", () => {
	it("bootstraps categories on first resolve and caches thereafter", () => {
		const { library, audioBootstrapper } = buildLibrary();

		const first = library.audio("mock-audio");
		const second = library.audio("mock-audio");

		expect(first).toBe(second);
		expect(audioBootstrapper).toHaveBeenCalledTimes(1);
	});

	it("runs newly registered bootstrappers when category is invalidated", () => {
		const { library } = buildLibrary();

		library.audio("mock-audio");

		const newBootstrapper = vi.fn((reg: ProviderRegistry) => {
			reg.register("audio", {
				name: "new-provider",
				create: () => ({ id: "new" }) as any,
			});
		});

		library.registerBootstrapper("audio", newBootstrapper);

		const provider = library.audio("new-provider");
		expect(provider).toEqual({ id: "new" });
		expect(newBootstrapper).toHaveBeenCalledTimes(1);
	});

	it("bootsraps when listing providers for a category", () => {
		const { library, audioBootstrapper } = buildLibrary();

		const summaries = library.list("audio");

		expect(audioBootstrapper).toHaveBeenCalledTimes(1);
		expect(summaries.map((summary) => summary.name)).toEqual(["mock-audio"]);
	});
});
