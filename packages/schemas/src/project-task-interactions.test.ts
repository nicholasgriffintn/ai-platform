import { describe, expect, it } from "vitest";

import { projectTaskInteractionSchema } from "./project-tasks";

describe("project task interactions", () => {
  it("preserves structured question choices and free-text support", () => {
    const interaction = projectTaskInteractionSchema.parse({
      protocolVersion: 1,
      type: "question",
      projectId: "project-1",
      taskId: "task-1",
      runId: "run-1",
      interactionId: "interaction-1",
      status: "pending",
      requestedAt: "2026-09-05T12:00:00.000Z",
      resolvedAt: null,
      detail: null,
      questions: [
        {
          id: "format",
          prompt: "Which format?",
          options: [{ label: "Brief", description: "A compact answer." }],
          allowOther: true,
        },
      ],
      answers: null,
    });

    expect(interaction).toMatchObject({
      type: "question",
      questions: [{ allowOther: true, options: [{ label: "Brief" }] }],
    });
  });

  it("keeps an interrupted exact-operation approval distinct from a rejection", () => {
    expect(
      projectTaskInteractionSchema.parse({
        protocolVersion: 1,
        type: "approval",
        projectId: "project-1",
        taskId: "task-1",
        runId: "run-1",
        interactionId: "approval-1",
        status: "interrupted",
        requestedAt: "2026-09-05T12:00:00.000Z",
        resolvedAt: "2026-09-05T12:01:00.000Z",
        detail: "The decision was saved, but the provider could not resume.",
        toolName: "use_recipe_connector",
        reason: "Read the connected service",
        resolution: "approved",
      }),
    ).toMatchObject({ status: "interrupted", resolution: "approved" });
  });

  it("rejects question cards that provide no possible answer", () => {
    expect(() =>
      projectTaskInteractionSchema.parse({
        protocolVersion: 1,
        type: "question",
        projectId: "project-1",
        taskId: "task-1",
        runId: "run-1",
        interactionId: "interaction-1",
        status: "pending",
        requestedAt: "2026-09-05T12:00:00.000Z",
        resolvedAt: null,
        detail: null,
        questions: [{ id: "format", prompt: "Which format?", options: [], allowOther: false }],
        answers: null,
      }),
    ).toThrow();
  });
});
