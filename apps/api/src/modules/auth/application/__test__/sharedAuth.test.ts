import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const useAuthPlugin = vi.hoisted(() => vi.fn());
const createAuth = vi.hoisted(() => vi.fn(() => ({ use: useAuthPlugin })));
const createGitHubAuth = vi.hoisted(() => vi.fn(() => ({ provider: "github" })));

vi.mock("@ngriffin_uk/auth-core", () => ({
  createAuth,
  isRecord: (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value),
}));

vi.mock("@ngriffin_uk/auth-provider-github", () => ({ createGitHubAuth }));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { createAssistantGitHubAuth } from "~/modules/auth/application/sharedAuth";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";
import { OAuthStateRepository } from "~/modules/auth/infrastructure/OAuthStateRepository";
import { SessionRepository } from "~/modules/auth/infrastructure/SessionRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

describe("Assistant GitHub authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the configured public API URL for the OAuth callback", () => {
    createAssistantGitHubAuth({
      env: {
        API_BASE_URL: "http://localhost:8787",
        GITHUB_CLIENT_ID: "client-id",
        GITHUB_CLIENT_SECRET: "client-secret",
      },
      repositories: fakeRepositories([
        [AuthChallengeRepository, {}],
        [OAuthStateRepository, {}],
        [SessionRepository, {}],
        [UserRepository, {}],
      ]),
    } as ServiceContext);

    expect(createGitHubAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: "http://localhost:8787/auth/github/callback",
      }),
    );
  });

  it("reports missing GitHub settings as a configuration error", () => {
    expect(() =>
      createAssistantGitHubAuth({
        env: { API_BASE_URL: "https://api.polychat.app" },
      } as ServiceContext),
    ).toThrowError(AssistantError);
  });
});
