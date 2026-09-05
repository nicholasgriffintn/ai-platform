import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { getProjectTaskInteraction } from "../interactions";

function task(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: "task-1",
    projectId: "project-1",
    conversationId: "conversation-1",
    runId: "run-1",
    status: "blocked",
    blockedReason: "awaiting_input",
    blockedDetail: null,
    ...overrides,
  } as ProjectTask;
}

function context(message: Record<string, unknown>): ServiceContext {
  return {
    repositories: {
      messages: {
        getLatestProjectTaskInteractionMessage: vi.fn().mockResolvedValue(message),
      },
    },
  } as unknown as ServiceContext;
}

describe("project task interaction projection", () => {
  it("returns structured pending questions for the exact task run", async () => {
    await expect(
      getProjectTaskInteraction(
        context({
          run_id: "run-1",
          timestamp: 1_788_609_600_000,
          data: JSON.stringify({
            interactionId: "question-1",
            requestedAt: "2026-09-05T12:00:00.000Z",
            questions: [
              {
                id: "format",
                prompt: "Which format?",
                options: [{ label: "Brief", description: "A short answer." }],
                allowOther: true,
              },
            ],
            humanInTheLoop: {
              type: "question",
              status: "pending",
              interactionId: "question-1",
              requires_user_action: true,
            },
          }),
        }),
        task(),
      ),
    ).resolves.toMatchObject({
      type: "question",
      interactionId: "question-1",
      status: "pending",
      questions: [{ id: "format", allowOther: true }],
    });
  });

  it("reports an acknowledged approval whose provider continuation was interrupted", async () => {
    await expect(
      getProjectTaskInteraction(
        context({
          run_id: "run-1",
          created_at: "2026-09-05T12:00:00.000Z",
          data: {
            resolved: true,
            resolvedAt: "2026-09-05T12:01:00.000Z",
            resolution: "approved",
            approval: {
              interactionId: "approval-1",
              toolName: "use_recipe_connector",
              reason: "Read from the connected service",
            },
            humanInTheLoop: {
              type: "approval",
              status: "resolved",
              interactionId: "approval-1",
            },
          },
        }),
        task({
          blockedReason: "dispatch_failed",
          blockedDetail: "The decision was saved, but the provider could not resume.",
        }),
      ),
    ).resolves.toMatchObject({
      type: "approval",
      status: "interrupted",
      resolution: "approved",
      detail: "The decision was saved, but the provider could not resume.",
    });
  });

  it("does not surface a stale interaction from another run", async () => {
    await expect(
      getProjectTaskInteraction(
        context({
          run_id: "run-old",
          data: {
            interactionId: "question-old",
            questions: [{ id: "format", prompt: "Which format?", options: [], allowOther: true }],
            humanInTheLoop: {
              type: "question",
              status: "pending",
              interactionId: "question-old",
            },
          },
        }),
        task(),
      ),
    ).resolves.toBeNull();
  });

  it("keeps an expired question visibly non-pending", async () => {
    await expect(
      getProjectTaskInteraction(
        context({
          run_id: "run-1",
          data: {
            interactionId: "question-1",
            requestedAt: "2026-08-01T12:00:00.000Z",
            expiredAt: "2026-09-05T12:00:00.000Z",
            questions: [{ id: "format", prompt: "Which format?", options: [], allowOther: true }],
            humanInTheLoop: {
              type: "question",
              status: "expired",
              interactionId: "question-1",
            },
          },
        }),
        task({ blockedReason: "run_failed" }),
      ),
    ).resolves.toMatchObject({ status: "expired", resolvedAt: "2026-09-05T12:00:00.000Z" });
  });
});
