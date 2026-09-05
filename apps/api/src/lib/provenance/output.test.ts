import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import {
  createExecutionOutputProvenance,
  legacyOutputProvenance,
  parseOutputProvenance,
} from "./output";

const capturedAt = "2026-09-05T12:00:00.000Z";

function contextForRun(initiatorUserId = 42): ServiceContext {
  return {
    requireUser: () => ({ id: 42 }),
    ensureDatabase: () => ({}),
    repositories: {
      conversationRuns: {
        getById: vi.fn().mockResolvedValue({
          id: "run-1",
          attempt: 3,
          initiatorUserId,
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
    },
  } as unknown as ServiceContext;
}

describe("output provenance", () => {
  it("records the effective handoff model while retaining immutable run evidence", async () => {
    const provenance = await createExecutionOutputProvenance(contextForRun(), {
      runId: "run-1",
      modelId: "handoff-model",
      provider: "handoff-provider",
      capturedAt,
    });

    expect(provenance).toEqual({
      protocolVersion: 1,
      capturedAt,
      completeness: "complete",
      origin: "generated",
      run: { id: "run-1", attempt: 3 },
      model: { id: "handoff-model", provider: "handoff-provider" },
      skills: [{ id: "research", name: "Research", revision: 7 }],
      sources: [{ id: "source-1", name: "Brief", state: "referenced" }],
      approvals: [{ id: "approval-1", type: "approval", status: "approved", toolName: "publish" }],
    });
    expect(JSON.stringify(provenance)).not.toContain("prompt");
  });

  it("rejects cross-owner run references before copying provenance", async () => {
    await expect(
      createExecutionOutputProvenance(contextForRun(7), {
        runId: "run-1",
        modelId: "model-1",
        provider: "provider-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("keeps missing historical data explicitly legacy", () => {
    expect(parseOutputProvenance(null, capturedAt)).toEqual(legacyOutputProvenance(capturedAt));
  });
});
