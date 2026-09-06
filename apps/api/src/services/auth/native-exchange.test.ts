import { hashSecret } from "@ngriffin_uk/auth-core";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { exchangeNativeAuthCode, generateNativeAuthExchangeCode } from "./sessions";

const SESSION_TOKEN = "session-token-from-the-oauth-callback";

function contextFor({ consumed = true, userId = 7 }: { consumed?: boolean; userId?: number } = {}) {
  const consumeNativeAuthCode = vi.fn().mockResolvedValue(consumed);
  const updateSessionJwt = vi.fn().mockResolvedValue(undefined);
  const getSessionWithJwt = vi.fn(async (sessionId: string) =>
    sessionId === (await hashSecret(SESSION_TOKEN))
      ? {
          id: sessionId,
          user_id: userId,
          expires_at: "2099-01-01",
          jwt_token: null,
          jwt_expires_at: null,
        }
      : null,
  );

  return {
    consumeNativeAuthCode,
    context: Object.assign(Object.create(null), {
      env: { JWT_SECRET: "a-secret-long-enough-for-hmac-signing" },
      repositories: {
        sessions: { getSessionWithJwt, updateSessionJwt, consumeNativeAuthCode },
        users: {
          getUserById: vi.fn().mockResolvedValue({ id: userId, email: "pip@polychat.test" }),
        },
      },
    }) as unknown as ServiceContext,
  };
}

describe("native auth code exchange", () => {
  it("turns a freshly issued code into a session token", async () => {
    const { context, consumeNativeAuthCode } = contextFor();
    const { code } = await generateNativeAuthExchangeCode({
      context,
      userId: 7,
      sessionId: SESSION_TOKEN,
    });

    const result = await exchangeNativeAuthCode({ context, code });

    expect(result.token).toBeTruthy();
    expect(result.sessionId).toBe(SESSION_TOKEN);
    expect(consumeNativeAuthCode).toHaveBeenCalledOnce();
  });

  it("refuses a code whose session no longer exists", async () => {
    const { context } = contextFor();
    const { code } = await generateNativeAuthExchangeCode({
      context,
      userId: 7,
      sessionId: "a-session-that-was-revoked",
    });

    await expect(exchangeNativeAuthCode({ context, code })).rejects.toThrow(/session/i);
  });

  it("refuses a code that has already been exchanged", async () => {
    const { context } = contextFor({ consumed: false });
    const { code } = await generateNativeAuthExchangeCode({
      context,
      userId: 7,
      sessionId: SESSION_TOKEN,
    });

    await expect(exchangeNativeAuthCode({ context, code })).rejects.toThrow();
  });
});
