import { describe, expect, it, vi } from "vitest";

import { ProviderRegistry } from "~/lib/providers/registry/ProviderRegistry";
import { AssistantError } from "~/utils/errors";
import type { AudioProvider } from "~/lib/providers/capabilities/audio";
import type { ProviderRegistration } from "~/lib/providers/registry/types";

const createAudioProvider = (name: string): AudioProvider => ({
	name,
	async synthesize() {
		return { key: `${name}-key` };
	},
});

const createRegistration = (
	name = "test",
): ProviderRegistration<AudioProvider> => ({
	name,
	create: () => createAudioProvider(name),
});

describe("ProviderRegistry", () => {
	it("registers and resolves providers", () => {
		const registry = new ProviderRegistry();
		registry.register("audio", createRegistration());

		const instance = registry.resolve("audio", "test");
		expect(instance.name).toBe("test");
	});

	it("supports aliases for resolution", () => {
		const registry = new ProviderRegistry();
		registry.register("audio", {
			...createRegistration(),
			aliases: ["alias"],
		});

		const instance = registry.resolve("audio", "alias");
		expect(instance.name).toBe("test");
	});

	it("throws when registering duplicate providers", () => {
		const registry = new ProviderRegistry();
		registry.register("audio", createRegistration());

		expect(() => registry.register("audio", createRegistration())).toThrowError(
			AssistantError,
		);
	});

	it("caches singleton providers but recreates transient ones", () => {
		const registry = new ProviderRegistry();
		const singletonProvider = createAudioProvider("singleton");
		const singletonFactory = vi.fn(() => singletonProvider);
		let transientCounter = 0;
		const transientFactory = vi.fn(() =>
			createAudioProvider(`transient-${++transientCounter}`),
		);

		registry.register("audio", { name: "singleton", create: singletonFactory });
		registry.register("audio", {
			name: "transient",
			lifecycle: "transient",
			create: transientFactory,
		});

		const firstSingleton = registry.resolve("audio", "singleton");
		const secondSingleton = registry.resolve("audio", "singleton");
		expect(firstSingleton).toBe(secondSingleton);
		expect(singletonFactory).toHaveBeenCalledTimes(1);

		const firstTransient = registry.resolve("audio", "transient");
		const secondTransient = registry.resolve("audio", "transient");
		expect(firstTransient).not.toBe(secondTransient);
		expect(transientFactory).toHaveBeenCalledTimes(2);
	});

	it("lists providers per category in alphabetical order", () => {
		const registry = new ProviderRegistry();
		registry.register("audio", {
			name: "BProvider",
			create: () => createAudioProvider("BProvider"),
		});
		registry.register("audio", {
			name: "AProvider",
			create: () => createAudioProvider("AProvider"),
		});

		const list = registry.list("audio");
		expect(list.map((item) => item.name)).toEqual(["AProvider", "BProvider"]);
	});

	it("throws when resolving unknown categories or providers", () => {
		const registry = new ProviderRegistry();
		expect(() => registry.resolve("audio", "missing")).toThrowError(
			AssistantError,
		);

		registry.register("audio", createRegistration());
		expect(() => registry.resolve("audio", "unknown")).toThrowError(
			AssistantError,
		);
	});
});
