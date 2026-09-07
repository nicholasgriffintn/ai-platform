import { describe, expect, it, vi } from "vitest";

import { checkDelegationSpawn } from "../guards";

function context(overrides: Record<string, unknown> = {}) {
  return {
    request: {
      env: {},
      request: {
        completion_id: "conversation-1",
        run_id: "run-1",
        ...overrides,
      },
      context: {
        repositories: {
          delegations: { countLiveForParent: vi.fn().mockResolvedValue(0) },
        },
      },
    },
  } as any;
}

describe("checkDelegationSpawn", () => {
  it("refuses recursion from trusted delegation depth", async () => {
    const result = await checkDelegationSpawn(
      context({
        delegation_context: {
          delegationId: "delegation-1",
          depth: 1,
          rootConversationId: "root-1",
        },
      }),
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("cannot delegate further");
  });

  it("refuses fan-out after counting live children", async () => {
    const toolContext = context();
    toolContext.request.context.repositories.delegations.countLiveForParent.mockResolvedValue(3);

    const result = await checkDelegationSpawn(toolContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("maximum number");
  });

  it("ignores a model-supplied depth argument", async () => {
    const result = await checkDelegationSpawn(context({ arguments: { depth: 1 } }));

    expect(result.allowed).toBe(true);
    expect(result.depth).toBe(0);
  });
});
