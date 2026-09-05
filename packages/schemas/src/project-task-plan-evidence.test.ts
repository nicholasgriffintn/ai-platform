import { describe, expect, it } from "vitest";

import { projectTaskPlanEvidenceSchema } from "./project-tasks";

describe("project task plan evidence contract", () => {
  it("keeps proposed stages separate from exact execution attempts and outputs", () => {
    const plan = projectTaskPlanEvidenceSchema.parse({
      protocolVersion: 1,
      id: "task-1",
      status: "active",
      stages: [
        {
          id: "task-1:build",
          flowStageId: "build",
          name: "Build",
          status: "completed",
          input: { objective: "Ship the report", acceptanceCriterionIds: ["criterion-1"] },
          attempts: [
            {
              id: "run-1:1",
              runId: "run-1",
              conversationId: "conversation-1",
              attempt: 1,
              status: "succeeded",
              startedAt: "2026-09-05T10:00:00.000Z",
              completedAt: "2026-09-05T10:01:00.000Z",
              terminalReason: null,
              provenance: {
                protocolVersion: 1,
                capturedAt: "2026-09-05T10:01:00.000Z",
                completeness: "complete",
                origin: "generated",
                run: { id: "run-1", attempt: 1 },
                model: { id: "model-1", provider: "provider-1" },
                skills: [],
                sources: [],
                approvals: [],
              },
              completionIds: ["completion-1"],
              outputs: [{ id: "output-1", title: "Report", kind: "report", status: "ready" }],
            },
          ],
          completionIds: ["completion-1"],
          outputs: [{ id: "output-1", title: "Report", kind: "report", status: "ready" }],
        },
        {
          id: "task-1:publish",
          flowStageId: "publish",
          name: "Publish",
          status: "proposed",
          input: { objective: "Ship the report", acceptanceCriterionIds: ["criterion-1"] },
          attempts: [],
          completionIds: [],
          outputs: [],
        },
      ],
      resume: { supported: false, reason: "Waiting for review." },
    });

    expect(plan.stages[0]).toMatchObject({ status: "completed", completionIds: ["completion-1"] });
    expect(plan.stages[1]).toMatchObject({ status: "proposed", attempts: [] });
  });
});
