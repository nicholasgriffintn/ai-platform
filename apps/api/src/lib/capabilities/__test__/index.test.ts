import { describe, expect, it, vi } from "vitest";

import { validateCapabilityReference } from "~/lib/capabilities";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { assistantRecipes } from "~/services/apps/recipes/catalog";

function createAgentContext(overrides: {
  userId: number;
  ownerScopeType: "user" | "workspace";
  ownerScopeId: string;
  role?: "owner" | "admin" | "member" | null;
}) {
  const user = { id: overrides.userId, plan_id: "pro" };

  return {
    user,
    requireUser: () => user,
    repositories: {
      agents: {
        getAgentById: vi.fn(async () => ({
          id: "agent-1",
          user_id: 7,
          owner_scope_type: overrides.ownerScopeType,
          owner_scope_id: overrides.ownerScopeId,
        })),
      },
      workspaces: {
        getWorkspace: vi.fn(async () => ({ id: overrides.ownerScopeId })),
        getMembership: vi.fn(async () => (overrides.role ? { role: overrides.role } : null)),
      },
    },
  } as unknown as ServiceContext;
}

describe("attaching an agent to a project", () => {
  it("accepts a workspace agent from a workspace the person belongs to", async () => {
    const context = createAgentContext({
      userId: 9,
      ownerScopeType: "workspace",
      ownerScopeId: "workspace-1",
      role: "member",
    });

    await expect(validateCapabilityReference("agent", "agent-1", context)).resolves.toBeUndefined();
  });

  it("refuses an agent the person cannot read", async () => {
    const context = createAgentContext({
      userId: 9,
      ownerScopeType: "user",
      ownerScopeId: "7",
    });

    await expect(validateCapabilityReference("agent", "agent-1", context)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("refuses an agent when there is no authenticated caller", async () => {
    await expect(validateCapabilityReference("agent", "agent-1")).rejects.toMatchObject({
      message: "Unknown agent",
      statusCode: 404,
    });
  });
});

describe("project capability references", () => {
  it("accepts catalogue apps and recipes", async () => {
    await expect(
      validateCapabilityReference("app", "featured-article-processor"),
    ).resolves.toBeUndefined();
    await expect(
      validateCapabilityReference("recipe", assistantRecipes[0].id),
    ).resolves.toBeUndefined();
  });

  it("rejects references outside the published catalogues", async () => {
    await expect(validateCapabilityReference("app", "unknown-app")).rejects.toMatchObject({
      message: "Unknown experience",
      statusCode: 404,
    });
    await expect(validateCapabilityReference("recipe", "unknown-recipe")).rejects.toMatchObject({
      message: "Unknown recipe",
      statusCode: 404,
    });
  });

  it("leaves tool validation to the configuration boundary", async () => {
    await expect(validateCapabilityReference("tool", "web_fetch")).resolves.toBeUndefined();
  });
});
