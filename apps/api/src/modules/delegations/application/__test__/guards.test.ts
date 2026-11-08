import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { DelegationRepository } from "~/modules/delegations/infrastructure/DelegationRepository";

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
        repositories: fakeRepositories([
          [DelegationRepository, { countLiveForParent: vi.fn().mockResolvedValue(0) }],
          [ConversationRunRepository, { getById: vi.fn().mockResolvedValue(null) }],
        ]),
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

    toolContext.request.context.repositories
      .get(DelegationRepository)
      .countLiveForParent.mockResolvedValue(3);

    const result = await checkDelegationSpawn(toolContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("maximum number");
  });

  it("refuses to spend outside a capped parent run", async () => {
    const toolContext = context();

    toolContext.request.context.repositories
      .get(ConversationRunRepository)
      .getById.mockResolvedValue({ spendCapCreditMicros: 5_000_000 });

    const result = await checkDelegationSpawn(toolContext);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("credit cap");
  });
});
