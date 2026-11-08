import { hireTeammateSchema } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { hireTeammate } from "../hire";

const OWNER_ID = 7;

function createContext() {
  const currentUser = { id: OWNER_ID, plan_id: "pro" };
  const repositories = {
    teammates: {
      createTeammate: vi.fn(async (record: Record<string, unknown>) => ({
        id: "teammate-1",
        user_id: OWNER_ID,
        owner_scope_type: "user",
        owner_scope_id: String(OWNER_ID),
        derived_from_teammate_id: null,
        kind: record.kind ?? "colleague",
        name: record.name,
        description: record.description,
        avatar_url: null,
        servers: null,
        model: null,
        temperature: null,
        max_steps: null,
        system_prompt: record.systemPrompt ?? null,
        few_shot_examples: null,
        enabled_tools: record.enabledTools ?? null,
        skill_ids: null,
        mode: record.mode ?? null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    },
    workspaces: {
      getWorkspace: vi.fn(async () => ({ id: "workspace-1" })),
      getMembership: vi.fn(async () => ({ role: "owner" })),
    },
  };

  return {
    context: {
      ensureDatabase: vi.fn(),
      user: currentUser,
      requireUser: vi.fn(() => currentUser),
      repositories: fakeRepositories([
        [TeammateRepository, repositories.teammates],
        [WorkspaceRepository, repositories.workspaces],
      ]),
    } as unknown as ServiceContext,
    repositories,
  };
}

describe("hireTeammate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a bot role away from task and memory writes", async () => {
    const { context, repositories } = createContext();

    await hireTeammate(context, hireTeammateSchema.parse({ role_slug: "daily-briefer" }));

    const record = repositories.teammates.createTeammate.mock.calls[0]?.[0] as {
      kind: string;
      enabledTools: string[];
    };

    expect(record.kind).toBe("bot");
    expect(record.enabledTools).not.toContain("create_task");
    expect(record.enabledTools).not.toContain("store_memory");
  });
});
