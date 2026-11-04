import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";
import type { AppAuthorisationStart } from "@ngriffin_uk/polychat-schemas";
import { sha256Base64Url } from "@ngriffin_uk/polychat-utility-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";

import { exchangeAppCode, startAppAuthorisation } from "../app-authorisation";
import {
  decideDeviceAuthorisation,
  getDeviceAuthorisation,
  startDeviceAuthorisation,
} from "../device-authorisation";

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

  it("presents the registered name as verified, not one the caller chose", async () => {
    const { authorisation_url } = await startAppAuthorisation(
      harness.context,
      await startRequest(),
    );
    const userCode = new URL(authorisation_url).searchParams.get("user_code") ?? "";

    expect(await getDeviceAuthorisation(harness.context, userCode)).toMatchObject({
      clientName: "Pashi",
      scope: "pashi",
      verified: true,
    });
  });

  it("returns the code and state to the registered address only", async () => {
    const target = await approve(harness.context);

    expect(`${target.origin}${target.pathname}`).toBe(REDIRECT_URI);
    expect(target.searchParams.get("state")).toBe(STATE);
    expect(target.searchParams.get("code")).toBeTruthy();
  });

  it("issues a Pashi-scoped key and revokes the keys it replaces", async () => {
    const target = await approve(harness.context);

    expect(await exchange(harness.context, target.searchParams.get("code") ?? "")).toEqual({
      access_token: "ak_new",
      token_type: "Bearer",
    });
    expect(harness.apiKeys.createApiKey).toHaveBeenCalledWith(7, "Pashi", "pashi");
    expect(harness.apiKeys.deleteOtherApiKeysForScope).toHaveBeenCalledWith(7, "pashi", "new-key");
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

  it("will not exchange a code twice", async () => {
    const target = await approve(harness.context);
    const code = target.searchParams.get("code") ?? "";

    await exchange(harness.context, code);

    expect(await exchange(harness.context, code)).toEqual({ error: "invalid_grant" });
    expect(harness.apiKeys.createApiKey).toHaveBeenCalledOnce();
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

  it("sends a refusal back with no code", async () => {
    const target = await approve(harness.context, "deny");

    expect(target.searchParams.get("error")).toBe("access_denied");
    expect(target.searchParams.get("code")).toBeNull();
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

  it("allows only the callback path on loopback in development", async () => {
    const { context } = createContext({ ENV: "development" });

    await expect(
      startAppAuthorisation(
        context,
        await startRequest({ redirect_uri: "http://localhost:5173/api/polychat/callback" }),
      ),
    ).resolves.toMatchObject({ expires_in: 600 });
    await expect(
      startAppAuthorisation(
        context,
        await startRequest({ redirect_uri: "http://localhost:5173/elsewhere" }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("device sign-in for registered apps", () => {
  it("refuses a registered app's scope", async () => {
    const { context } = createContext();

    await expect(startDeviceAuthorisation(context, "Pashi", "pashi")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("marks a self-declared name as unverified", async () => {
    const { context } = createContext();
    const { user_code } = await startDeviceAuthorisation(context, "Living room TV", "discover");

    expect(await getDeviceAuthorisation(context, user_code)).toMatchObject({
      clientName: "Living room TV",
      verified: false,
    });
  });
});
