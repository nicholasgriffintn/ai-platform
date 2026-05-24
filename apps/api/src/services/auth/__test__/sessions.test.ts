import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import jwt from "@tsndr/cloudflare-worker-jwt";
import type { JwtData } from "@tsndr/cloudflare-worker-jwt";

import { ErrorType } from "~/utils/errors";
import { exchangeMobileAuthCode, generateMobileAuthExchangeCode } from "../sessions";

vi.mock("@tsndr/cloudflare-worker-jwt", () => ({
	default: {
		decode: vi.fn(),
		sign: vi.fn(),
		verify: vi.fn(),
	},
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "mobile-code-jti"),
}));

interface TestMobileAuthPayload {
	purpose: string;
	jti: string;
	sub: string;
	session_id: string;
	iss: string;
	aud: string;
	exp: number;
}

describe("mobile auth sessions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-24T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("signs exchange codes with a replay identifier", async () => {
		const sign = vi.mocked(jwt.sign);
		sign.mockResolvedValue("signed-mobile-code");

		const result = await generateMobileAuthExchangeCode({
			context: {
				env: { JWT_SECRET: "secret" },
			} as any,
			userId: 123,
			sessionId: "session-1",
		});

		expect(result).toEqual({
			code: "signed-mobile-code",
			expires_in: 60,
		});
		expect(sign).toHaveBeenCalledWith(
			expect.objectContaining({
				purpose: "mobile_auth_exchange",
				jti: "mobile-code-jti",
				sub: "123",
				session_id: "session-1",
				iss: "assistant",
				aud: "assistant-mobile",
			}),
			"secret",
			{ algorithm: "HS256" },
		);
	});

	it("rejects replayed exchange codes before minting a bearer token", async () => {
		vi.mocked(jwt.verify).mockResolvedValue({
			header: { alg: "HS256" },
			payload: {},
		});
		const decoded: JwtData<TestMobileAuthPayload> = {
			header: { alg: "HS256" },
			payload: {
				purpose: "mobile_auth_exchange",
				jti: "mobile-code-jti",
				sub: "123",
				session_id: "session-1",
				iss: "assistant",
				aud: "assistant-mobile",
				exp: Math.floor(Date.now() / 1000) + 60,
			},
		};
		vi.mocked(jwt.decode<TestMobileAuthPayload>).mockReturnValue(decoded);

		const sessions = {
			getSessionWithJwt: vi.fn().mockResolvedValue({
				id: "session-1",
				user_id: 123,
				expires_at: "2026-05-31T12:00:00.000Z",
				jwt_token: null,
				jwt_expires_at: null,
			}),
			consumeMobileAuthCode: vi.fn().mockResolvedValue(false),
			updateSessionJwt: vi.fn(),
		};
		const users = {
			getUserById: vi.fn(),
		};

		await expect(
			exchangeMobileAuthCode({
				context: {
					env: { JWT_SECRET: "secret" },
					repositories: {
						sessions,
						users,
					},
				} as any,
				code: "signed-mobile-code",
			}),
		).rejects.toMatchObject({
			message: "Invalid or expired mobile auth code",
			type: ErrorType.AUTHENTICATION_ERROR,
			statusCode: 401,
		});

		expect(sessions.consumeMobileAuthCode).toHaveBeenCalledWith({
			jti: "mobile-code-jti",
			sessionId: "session-1",
			userId: 123,
			expiresAt: new Date((Math.floor(Date.now() / 1000) + 60) * 1000),
		});
		expect(users.getUserById).not.toHaveBeenCalled();
		expect(sessions.updateSessionJwt).not.toHaveBeenCalled();
	});
});
