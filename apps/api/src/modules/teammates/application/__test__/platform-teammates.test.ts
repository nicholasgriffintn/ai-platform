import { getPlatformTeammateBrief } from "@ngriffin_uk/polychat-ai-prompts";
import { PLATFORM_TEAMMATES, type PlatformTeammate } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { ensurePlatformTeammates } from "../platform-teammates";

function catalogueRow(
  teammate: PlatformTeammate = PLATFORM_TEAMMATES[0],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: teammate.id,
    user_id: -1,
    owner_scope_type: "platform",
    owner_scope_id: "platform",
    derived_from_teammate_id: null,
    kind: teammate.kind,
    workspace_default: false,
    name: teammate.name,
    description: teammate.summary,
    avatar_url: null,
    servers: [],
    model: null,
    temperature: null,
    max_steps: teammate.maxSteps,
    system_prompt: getPlatformTeammateBrief(teammate.id),
    few_shot_examples: null,
    enabled_tools: [...teammate.tools],
    skill_ids: [...teammate.skillIds],
    mode: teammate.mode,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createContext(existing: ReturnType<typeof catalogueRow>[]) {
  const upsertPlatformTeammates = vi.fn(async (_records: unknown[]) => undefined);

  return {
    context: {
      ensureDatabase: vi.fn(),
      repositories: {
        teammates: {
          listPlatformTeammates: vi.fn(async () => existing),
          upsertPlatformTeammates,
        },
      },
    } as unknown as ServiceContext,
    upsertPlatformTeammates,
  };
}

describe("ensurePlatformTeammates", () => {
  it("writes nothing when the rows already match the definitions", async () => {
    const { context, upsertPlatformTeammates } = createContext(
      PLATFORM_TEAMMATES.map((teammate) => catalogueRow(teammate)),
    );

    await ensurePlatformTeammates(context);

    expect(upsertPlatformTeammates).not.toHaveBeenCalled();
  });

  it("updates only the teammate whose definition drifted", async () => {
    const drifted = PLATFORM_TEAMMATES[0];
    const { context, upsertPlatformTeammates } = createContext([
      catalogueRow(drifted, { name: "Old name" }),
      ...PLATFORM_TEAMMATES.slice(1).map((teammate) => catalogueRow(teammate)),
    ]);

    await ensurePlatformTeammates(context);

    expect(upsertPlatformTeammates).toHaveBeenCalledWith([
      expect.objectContaining({ id: drifted.id }),
    ]);
  });
});
