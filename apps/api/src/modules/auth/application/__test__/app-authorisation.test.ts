import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import type { AppAuthorisationStart } from "@ngriffin_uk/polychat-schemas";
import { sha256Base64Url } from "@ngriffin_uk/polychat-utility-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";

import { exchangeAppCode, startAppAuthorisation } from "../app-authorisation";
import { decideDeviceAuthorisation } from "../device-authorisation";

const REDIRECT_URI = "https://pashi.app/api/polychat/callback";
const VERIFIER = "v".repeat(64);
const STATE = "s".repeat(64);

function createContext(env: Record<string, string> = {}) {
  const challenges = new Map<string, AuthChallengeRecord>();
  const apiKeys = {
    createApiKey: vi.fn(async () => ({
      metadata: { created_at: "now", id: "new-key", name: "Pashi" },
      plaintextKey: "ak_new",
    })),
    deleteOtherApiKeysForScope: vi.fn(async () => undefined),
  };
  const challengeRepository = {
    consumeByTokenHash: async (hash: string) => {
      const record = challenges.get(hash) ?? null;

      challenges.delete(hash);

      return record;
    },
    create: async (record: AuthChallengeRecord) => void challenges.set(record.tokenHash, record),
    deleteExpiredForProvider: async () => undefined,
    findByTokenHash: async (hash: string) => challenges.get(hash) ?? null,
  };
  const context = {
    ensureDatabase: () => undefined,
    env: { APP_BASE_URL: "https://polychat.test", ...env },
    repositories: fakeRepositories([
      [ApiKeyRepository, apiKeys],
      [AuthChallengeRepository, challengeRepository],
    ]),
    requireUser: () => ({ id: 7 }),
  } as unknown as ServiceContext;

  return { apiKeys, context };
}

async function startRequest(overrides: Partial<AppAuthorisationStart> = {}) {
  return {
    client_id: "pashi",
    code_challenge: await sha256Base64Url(VERIFIER),
    code_challenge_method: "S256",
    redirect_uri: REDIRECT_URI,
    state: STATE,
    ...overrides,
  } satisfies AppAuthorisationStart;
}

async function approve(context: ServiceContext, decision: "approve" | "deny" = "approve") {
  const { authorisation_url } = await startAppAuthorisation(context, await startRequest());
  const userCode = new URL(authorisation_url).searchParams.get("user_code") ?? "";
  const result = await decideDeviceAuthorisation(context, userCode, decision);

  return new URL(result.redirect_url ?? "");
}

function exchange(context: ServiceContext, code: string, verifier = VERIFIER, uri = REDIRECT_URI) {
  return exchangeAppCode(context, {
    client_id: "pashi",
    code,
    code_verifier: verifier,
    redirect_uri: uri,
  });
}

describe("app authorisation", () => {
  let harness: ReturnType<typeof createContext>;

  beforeEach(() => {
    harness = createContext();
  });

  it("gives nothing to someone without the verifier, and burns the code", async () => {
    const target = await approve(harness.context);
    const code = target.searchParams.get("code") ?? "";

    expect(await exchange(harness.context, code, "x".repeat(64))).toEqual({
      error: "invalid_grant",
    });
    expect(await exchange(harness.context, code)).toEqual({ error: "invalid_grant" });
    expect(harness.apiKeys.createApiKey).not.toHaveBeenCalled();
  });

  it("refuses an exchange for a different redirect address", async () => {
    const target = await approve(harness.context);

    expect(
      await exchange(
        harness.context,
        target.searchParams.get("code") ?? "",
        VERIFIER,
        "https://evil.example/callback",
      ),
    ).toEqual({ error: "invalid_grant" });
  });

  it.each([
    ["another site", "https://evil.example/api/polychat/callback"],
    ["a lookalike host", "https://pashi.app.evil.example/api/polychat/callback"],
    ["another path", "https://pashi.app/other"],
    ["loopback outside development", "http://localhost:5173/api/polychat/callback"],
  ])("refuses to start with %s", async (_name, redirectUri) => {
    await expect(
      startAppAuthorisation(harness.context, await startRequest({ redirect_uri: redirectUri })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
