import { findTeammateRole, hireTeammateSchema } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { hireTeammate } from "../hire";

const OWNER_ID = 7;

function createContext() {
  const currentUser = { id: OWNER_ID, plan_id: "pro" };
  const repositories = {
    agents: {
      createTeammate: vi.fn(async (record: Record<string, unknown>) => ({
        id: "teammate-1",
        user_id: OWNER_ID,
        owner_scope_type: "user",
        owner_scope_id: String(OWNER_ID),
        derived_from_agent_id: null,
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
      repositories,
    } as unknown as ServiceContext,
    repositories,
  };
}

describe("hireTeammate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("takes the brief, tools, mode and kind from the chosen role", async () => {
    const { context, repositories } = createContext();
    const role = findTeammateRole("research-analyst");

    await hireTeammate(context, hireTeammateSchema.parse({ role_slug: "research-analyst" }));

    expect(repositories.agents.createTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: role?.title,
        kind: "colleague",
        systemPrompt: role?.brief,
        enabledTools: [...(role?.suggestedTools ?? [])],
        mode: role?.mode,
      }),
    );
  });

  it("keeps a bot role away from task and memory writes", async () => {
    const { context, repositories } = createContext();

    await hireTeammate(context, hireTeammateSchema.parse({ role_slug: "daily-briefer" }));

    const record = repositories.agents.createTeammate.mock.calls[0]?.[0] as {
      kind: string;
      enabledTools: string[];
    };

    expect(record.kind).toBe("bot");
    expect(record.enabledTools).not.toContain("create_task");
    expect(record.enabledTools).not.toContain("store_memory");
  });

  it("appends a job description to the role brief", async () => {
    const { context, repositories } = createContext();
    const role = findTeammateRole("writing-partner");

    await hireTeammate(
      context,
      hireTeammateSchema.parse({
        role_slug: "writing-partner",
        job_description: "Always cite the style guide.",
        name: "Editor",
      }),
    );

    const record = repositories.agents.createTeammate.mock.calls[0]?.[0] as {
      name: string;
      systemPrompt: string;
    };

    expect(record.name).toBe("Editor");
    expect(record.systemPrompt).toBe(`${role?.brief}\n\nAlways cite the style guide.`);
  });

  it("hires from a job description alone when it is given a name", async () => {
    const { context, repositories } = createContext();

    await hireTeammate(
      context,
      hireTeammateSchema.parse({ job_description: "Watch our changelog.", name: "Changelog" }),
    );

    const record = repositories.agents.createTeammate.mock.calls[0]?.[0] as {
      name: string;
      systemPrompt: string;
      enabledTools: string[];
    };

    expect(record.name).toBe("Changelog");
    expect(record.systemPrompt).toBe("Watch our changelog.");
    expect(record.enabledTools).toEqual([]);
  });

  it("refuses a job description with no name to hire under", async () => {
    const { context, repositories } = createContext();

    const error = await hireTeammate(
      context,
      hireTeammateSchema.parse({ job_description: "Watch our changelog." }),
    ).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(400);
    expect(repositories.agents.createTeammate).not.toHaveBeenCalled();
  });

  it("refuses an unknown role", async () => {
    const { context, repositories } = createContext();

    const error = await hireTeammate(context, { role_slug: "chief-vibes-officer" }).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AssistantError).statusCode).toBe(400);
    expect(repositories.agents.createTeammate).not.toHaveBeenCalled();
  });
});
