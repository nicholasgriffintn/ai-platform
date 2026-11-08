import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { validateCapabilityReference } from "~/modules/capabilities/application/reference";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

function createTeammateContext(overrides: {
  userId: number;
  ownerScopeType: "user" | "workspace";
  ownerScopeId: string;
  role?: "owner" | "admin" | "member" | null;
}) {
  const user = { id: overrides.userId, plan_id: "pro" };

  return {
    user,
    requireUser: () => user,
    repositories: fakeRepositories([
      [
        TeammateRepository,
        {
          getTeammateById: vi.fn(async () => ({
            id: "teammate-1",
            user_id: 7,
            owner_scope_type: overrides.ownerScopeType,
            owner_scope_id: overrides.ownerScopeId,
          })),
        },
      ],
      [
        WorkspaceRepository,
        {
          getWorkspace: vi.fn(async () => ({ id: overrides.ownerScopeId })),
          getMembership: vi.fn(async () => (overrides.role ? { role: overrides.role } : null)),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("attaching an teammate to a project", () => {
  it("refuses an teammate the person cannot read", async () => {
    const context = createTeammateContext({
      userId: 9,
      ownerScopeType: "user",
      ownerScopeId: "7",
    });

    await expect(
      validateCapabilityReference("teammate", "teammate-1", context),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe("project capability references", () => {
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
});
