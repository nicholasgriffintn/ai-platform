import { describe, expect, it, vi } from "vitest";

import { AnonymousUserRepository } from "../AnonymousUserRepository";
import { UserRepository } from "../UserRepository";

describe("usage reset repositories", () => {
	it("resets each authenticated daily usage counter by UTC reset date", async () => {
		const repo = new UserRepository({ DB: {} as any } as any);
		const executeRunSpy = vi
			.spyOn(repo as any, "executeRun")
			.mockResolvedValueOnce({ meta: { changes: 2 } })
			.mockResolvedValueOnce({ meta: { changes: 1 } })
			.mockResolvedValueOnce({ meta: { changes: 3 } });

		const result = await repo.resetDailyUsage("2026-06-07T00:00:00.000Z");

		expect(result).toEqual({
			regular: 2,
			pro: 1,
			byok: 3,
			total: 6,
		});
		expect(executeRunSpy).toHaveBeenCalledTimes(3);
		expect(executeRunSpy.mock.calls[0]?.[0]).toContain("daily_message_count = 0");
		expect(executeRunSpy.mock.calls[0]?.[0]).toContain("date(daily_reset) < date(?)");
		expect(executeRunSpy.mock.calls[0]?.[1]).toEqual([
			"2026-06-07T00:00:00.000Z",
			"2026-06-07T00:00:00.000Z",
		]);
		expect(executeRunSpy.mock.calls[1]?.[0]).toContain("daily_pro_message_count = 0");
		expect(executeRunSpy.mock.calls[2]?.[0]).toContain("daily_byok_message_count = 0");
	});

	it("resets anonymous daily usage counters by UTC reset date", async () => {
		const repo = new AnonymousUserRepository({ DB: {} as any } as any);
		const executeRunSpy = vi
			.spyOn(repo as any, "executeRun")
			.mockResolvedValue({ meta: { changes: 4 } });

		const result = await repo.resetDailyUsage("2026-06-07T00:00:00.000Z");

		expect(result).toBe(4);
		expect(executeRunSpy).toHaveBeenCalledWith(
			expect.stringContaining("date(daily_reset) < date(?)"),
			["2026-06-07T00:00:00.000Z", "2026-06-07T00:00:00.000Z"],
		);
	});
});
