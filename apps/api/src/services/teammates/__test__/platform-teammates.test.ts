import { getPlatformTeammateBrief } from "@ngriffin_uk/polychat-ai-prompts";
import { builtInSkillDocuments } from "@ngriffin_uk/polychat-library-skills-catalogue";
import { PLATFORM_TEAMMATES, type PlatformTeammate } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { listFunctionToolDefinitions } from "~/services/functions/definitions";

import { ensurePlatformTeammates, resolvePlatformTeammateGrants } from "../platform-teammates";

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
  it("seeds every platform teammate when none exist", async () => {
    const { context, upsertPlatformTeammates } = createContext([]);

    await ensurePlatformTeammates(context);

    expect(upsertPlatformTeammates).toHaveBeenCalledTimes(1);
    expect(upsertPlatformTeammates.mock.calls[0]?.[0]).toHaveLength(PLATFORM_TEAMMATES.length);
  });

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

describe("platform teammate definitions", () => {
  const functionToolIds = new Set(listFunctionToolDefinitions().map((tool) => tool.name));
  const skillIds = new Set<string>(builtInSkillDocuments.map((document) => document.directory));

  it("only names tools and skills the platform actually ships", () => {
    for (const teammate of PLATFORM_TEAMMATES) {
      for (const toolId of teammate.tools) {
        expect(functionToolIds.has(toolId), `${teammate.slug}: ${toolId}`).toBe(true);
      }

      for (const skillId of teammate.skillIds) {
        expect(skillIds.has(skillId), `${teammate.slug}: ${skillId}`).toBe(true);
      }
    }
  });

  it("resolves the grants a platform teammate brings into a run", () => {
    const support = PLATFORM_TEAMMATES.find((teammate) => teammate.slug === "support");

    expect(resolvePlatformTeammateGrants({ teammateId: support?.id })).toEqual({
      tools: [...(support?.tools ?? [])],
      skillIds: [...(support?.skillIds ?? [])],
    });
    expect(resolvePlatformTeammateGrants({ teammateId: "teammate-1" })).toBeNull();
    expect(resolvePlatformTeammateGrants({})).toBeNull();
  });
});
