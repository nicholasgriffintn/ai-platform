import { describe, expect, it, vi } from "vitest";

import { SessionRepository } from "../SessionRepository";

describe("SessionRepository", () => {
	it("records a mobile auth exchange code once", async () => {
		const run = vi
			.fn()
			.mockResolvedValueOnce({ success: true, meta: { changes: 0 } })
			.mockResolvedValueOnce({ success: true, meta: { changes: 1 } });
		const bind = vi.fn((..._values: unknown[]) => ({ run }));
		const prepare = vi.fn((_query: string) => ({ bind }));
		const repository = new SessionRepository({
			DB: { prepare },
		} as any);

		const consumed = await repository.consumeMobileAuthCode({
			jti: "code-jti",
			sessionId: "session-1",
			userId: 123,
			expiresAt: new Date("2026-05-24T12:01:00.000Z"),
		});

		expect(consumed).toBe(true);
		expect(prepare).toHaveBeenCalledTimes(2);
		expect(prepare.mock.calls[1][0]).toContain("INSERT OR IGNORE INTO mobile_auth_exchange_code");
		expect(bind.mock.calls[1]).toEqual(["code-jti", "session-1", 123, "2026-05-24T12:01:00.000Z"]);
	});

	it("reports replayed mobile auth exchange codes", async () => {
		const run = vi
			.fn()
			.mockResolvedValueOnce({ success: true, meta: { changes: 0 } })
			.mockResolvedValueOnce({ success: true, meta: { changes: 0 } });
		const bind = vi.fn((..._values: unknown[]) => ({ run }));
		const prepare = vi.fn((_query: string) => ({ bind }));
		const repository = new SessionRepository({
			DB: { prepare },
		} as any);

		const consumed = await repository.consumeMobileAuthCode({
			jti: "code-jti",
			sessionId: "session-1",
			userId: 123,
			expiresAt: new Date("2026-05-24T12:01:00.000Z"),
		});

		expect(consumed).toBe(false);
	});
});
