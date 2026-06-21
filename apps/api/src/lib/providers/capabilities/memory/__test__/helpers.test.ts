import { beforeEach, describe, expect, it, vi } from "vitest";

import { providerLibrary } from "~/lib/providers/library";
import { getMemoryProvider } from "../helpers";

vi.mock("~/lib/providers/library", () => ({
	providerLibrary: {
		memory: vi.fn(),
	},
}));

describe("memory provider helpers", () => {
	const context = {
		env: { JWT_SECRET: "secret" },
		user: { id: 42 },
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses the built-in provider by default", () => {
		const provider = { name: "built-in" };
		vi.mocked(providerLibrary.memory).mockReturnValue(provider as any);

		expect(getMemoryProvider(context)).toBe(provider);
		expect(providerLibrary.memory).toHaveBeenCalledWith(
			"built-in",
			expect.objectContaining({
				env: context.env,
				user: context.user,
			}),
		);
	});

	it("resolves configured external providers through the registry", () => {
		const provider = { name: "hindsight" };
		vi.mocked(providerLibrary.memory).mockReturnValue(provider as any);

		expect(
			getMemoryProvider({
				...context,
				userSettings: { memory_provider: "hindsight" },
			}),
		).toBe(provider);

		expect(providerLibrary.memory).toHaveBeenCalledWith(
			"hindsight",
			expect.objectContaining({
				env: context.env,
				user: context.user,
				serviceContext: context.serviceContext,
			}),
		);
	});
});
