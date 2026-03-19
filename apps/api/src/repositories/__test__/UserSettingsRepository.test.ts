import { afterEach, describe, expect, it, vi } from "vitest";

import { UserSettingsRepository } from "../UserSettingsRepository";
import type { IEnv } from "~/types";

describe("UserSettingsRepository", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("looks up provider settings by provider_id when storing provider credentials", async () => {
		const repo = new UserSettingsRepository({ DB: {} as any } as IEnv);

		const runQuerySpy = vi
			.spyOn(repo as any, "runQuery")
			.mockResolvedValueOnce({ id: "provider-settings-row-id" })
			.mockResolvedValueOnce({
				public_key: JSON.stringify({ kty: "RSA", e: "AQAB", n: "test" }),
			});
		const executeRunSpy = vi
			.spyOn(repo as any, "executeRun")
			.mockResolvedValue({ success: true } as any);

		vi.stubGlobal("crypto", {
			subtle: {
				importKey: vi.fn().mockResolvedValue({}),
				encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
			},
		});

		await repo.storeProviderApiKey(42, "cartesia", "sk-test-value");

		expect(runQuerySpy).toHaveBeenCalledTimes(2);
		expect(runQuerySpy.mock.calls[0]?.[0]).toContain("provider_id = ?");
		expect(runQuerySpy.mock.calls[0]?.[1]).toEqual([42, "cartesia"]);
		expect(executeRunSpy).toHaveBeenCalledTimes(1);
	});
});
