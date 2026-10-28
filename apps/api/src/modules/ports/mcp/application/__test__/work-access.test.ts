import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuthChallengeRepository } from "~/modules/auth/infrastructure/AuthChallengeRepository";

import { mintWorkRunAccess, resolveWorkRunAccess } from "../work-access";

const access = {
  userId: 7,
  projectId: "project-1",
  teammateContextId: "context-1",
  conversationId: "task-conversation",
};

function context() {
  const records = new Map<string, Record<string, unknown>>();

  return Object.assign(Object.create(null), {
    repositories: fakeRepositories([
      [
        AuthChallengeRepository,
        {
          deleteExpiredForProvider: vi.fn(async () => undefined),
          create: vi.fn(async (record: Record<string, unknown>) => {
            records.set(String(record.tokenHash), record);
          }),
          findByTokenHash: vi.fn(async (hash: string) => records.get(hash) ?? null),
        },
      ],
    ]),
  });
}

describe("work run access", () => {
  it("resolves a token to the run it was minted for until it expires", async () => {
    const serviceContext = context();
    const now = new Date("2026-10-27T22:00:00Z");
    const token = await mintWorkRunAccess(serviceContext, access, now);

    await expect(resolveWorkRunAccess(serviceContext, token, now)).resolves.toEqual(access);
    await expect(
      resolveWorkRunAccess(serviceContext, token, new Date("2026-10-28T11:00:00Z")),
    ).resolves.toBeNull();
  });

  it("rejects anything that is not a run token", async () => {
    const serviceContext = context();

    await expect(resolveWorkRunAccess(serviceContext, "ak_personal_key")).resolves.toBeNull();
    await expect(resolveWorkRunAccess(serviceContext, "pcwr_unknown")).resolves.toBeNull();
    await expect(resolveWorkRunAccess(serviceContext, null)).resolves.toBeNull();
  });
});
