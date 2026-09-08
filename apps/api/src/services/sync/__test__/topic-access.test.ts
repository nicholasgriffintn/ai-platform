import { describe, expect, it } from "vitest";

import type { IEnv } from "~/types";

import { canSubscribeToTopic } from "../topic-access";

type Row = Record<string, unknown> | null;

function createEnv(responses: Record<string, Row>): IEnv {
  return {
    DB: {
      prepare(query: string) {
        const key = Object.keys(responses).find((candidate) => query.includes(candidate));

        return {
          bind: () => ({
            first: async () => (key ? responses[key] : null),
          }),
        };
      },
    },
  } as unknown as IEnv;
}

describe("canSubscribeToTopic", () => {
  it("allows a user topic that matches the connected user", async () => {
    await expect(canSubscribeToTopic(createEnv({}), "user:5", 5)).resolves.toBe(true);
  });

  it("refuses another user's topic", async () => {
    await expect(canSubscribeToTopic(createEnv({}), "user:6", 5)).resolves.toBe(false);
  });

  it("refuses a malformed topic", async () => {
    await expect(canSubscribeToTopic(createEnv({}), "nonsense", 5)).resolves.toBe(false);
  });

  it("allows a personal conversation owned by the user", async () => {
    const env = createEnv({ "FROM conversation": { user_id: 5, project_id: null } });

    await expect(canSubscribeToTopic(env, "conversation:abc", 5)).resolves.toBe(true);
  });

  it("refuses a personal conversation owned by somebody else", async () => {
    const env = createEnv({ "FROM conversation": { user_id: 9, project_id: null } });

    await expect(canSubscribeToTopic(env, "conversation:abc", 5)).resolves.toBe(false);
  });

  it("refuses a project conversation when the user is not a workspace member", async () => {
    const env = createEnv({
      "FROM conversation": { user_id: 5, project_id: "project-1" },
      "FROM project": { workspace_id: "workspace-1" },
      "FROM workspace_member": null,
    });

    await expect(canSubscribeToTopic(env, "conversation:abc", 5)).resolves.toBe(false);
  });

  it("allows a project conversation for a current workspace member", async () => {
    const env = createEnv({
      "FROM conversation": { user_id: 9, project_id: "project-1" },
      "FROM project": { workspace_id: "workspace-1" },
      "FROM workspace_member": { allowed: 1 },
    });

    await expect(canSubscribeToTopic(env, "conversation:abc", 5)).resolves.toBe(true);
  });

  it("refuses every scoped topic when no database is configured", async () => {
    await expect(canSubscribeToTopic({} as IEnv, "conversation:abc", 5)).resolves.toBe(false);
  });
});
