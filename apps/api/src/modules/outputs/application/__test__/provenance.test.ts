import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { createExecutionOutputProvenance } from "~/modules/outputs/application/provenance";

function contextForRun(initiatorUserId = 42): ServiceContext {
  return {
    requireUser: () => ({ id: 42 }),
    ensureDatabase: () => ({}),
    repositories: fakeRepositories([
      [
        ConversationRunRepository,
        {
          getById: vi.fn().mockResolvedValue({
            id: "run-1",
            attempt: 3,
            initiatorUserId,
            trigger: "user",
            projectId: null,
            context: {
              model: "original-model",
              provider: "original-provider",
              skills: [{ id: "research", name: "Research", state: "loaded", revision: 7 }],
              sources: [{ id: "source-1", name: "Brief", status: "included" }],
              approvals: [
                {
                  id: "approval-1",
                  type: "approval",
                  status: "approved",
                  toolName: "publish",
                },
              ],
            },
          }),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("output provenance", () => {
  it("rejects cross-owner run references before copying provenance", async () => {
    await expect(
      createExecutionOutputProvenance(contextForRun(7), {
        runId: "run-1",
        modelId: "model-1",
        provider: "provider-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
