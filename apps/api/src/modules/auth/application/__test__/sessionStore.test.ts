import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createAssistantSessionStores } from "~/modules/auth/application/sessionStore";

const user = { id: 7, email: "poly@example.com", created_at: "2026-10-01T00:00:00.000Z" };
const session = {
  tokenHash: "hash",
  userId: "7",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  expiresAt: new Date("2026-11-01T00:00:00.000Z"),
};

function stores(found: unknown) {
  const repositories = {
    sessions: { findWithUserByTokenHash: vi.fn(async () => found) },
    users: { getUserById: vi.fn(async () => ({ ...user, email: "fresh@example.com" })) },
  };

  return {
    repositories,
    ...createAssistantSessionStores({ repositories } as unknown as ServiceContext),
  };
}

describe("createAssistantSessionStores", () => {
  it("resolves the session's user from the joined lookup once, then reads fresh", async () => {
    const { sessions, users, repositories } = stores({ session, user });

    await expect(sessions.findByTokenHash("hash")).resolves.toEqual(session);
    await expect(users.findById("7")).resolves.toMatchObject({ email: "poly@example.com" });
    expect(repositories.users.getUserById).not.toHaveBeenCalled();

    await expect(users.findById("7")).resolves.toMatchObject({ email: "fresh@example.com" });
    expect(repositories.users.getUserById).toHaveBeenCalledWith(7);
  });

  it("falls back to the user table when the session's user row is missing", async () => {
    const { sessions, users, repositories } = stores({ session, user: null });

    await sessions.findByTokenHash("hash");
    await users.findById("7");

    expect(repositories.users.getUserById).toHaveBeenCalledWith(7);
  });
});
