import type { ProjectTaskPlanEvidence } from "@ngriffin_uk/polychat-schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TaskStageEvidence } from "./TaskStageEvidence";

afterEach(cleanup);

describe("TaskStageEvidence", () => {
  it("keeps proposals distinct and links exact attempts and outputs", () => {
    const plan: ProjectTaskPlanEvidence = {
      protocolVersion: 1,
      id: "task-1",
      status: "active",
      stages: [
        {
          id: "task-1:build",
          flowStageId: "build",
          name: "Build",
          status: "failed",
          input: { objective: "Ship the report", acceptanceCriterionIds: [] },
          completionIds: [],
          outputs: [{ id: "output-1", title: "Draft report", kind: "report", status: "ready" }],
          attempts: [
            {
              id: "run-1:1",
              runId: "run-1",
              conversationId: "conversation-1",
              attempt: 1,
              status: "failed",
              startedAt: "2026-09-05T10:00:00.000Z",
              completedAt: "2026-09-05T10:01:00.000Z",
              terminalReason: "Provider failed",
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
              completionIds: [],
              outputs: [{ id: "output-1", title: "Draft report", kind: "report", status: "ready" }],
              usage: {
                protocolVersion: 1,
                runId: "run-1",
                currentAttempt: 1,
                measurement: "unknown",
                reservation: null,
                consumption: {
                  status: "unknown",
                  eventCount: 0,
                  costMicros: null,
                  creditMicros: null,
                  estimatedPriceEventCount: 0,
                  bySource: [],
                },
                attempts: [],
                settlement: { status: "released", at: "2026-09-05T10:01:00.000Z" },
              },
            },
          ],
        },
        {
          id: "task-1:publish",
          flowStageId: "publish",
          name: "Publish",
          status: "proposed",
          input: { objective: "Ship the report", acceptanceCriterionIds: [] },
          attempts: [],
          completionIds: [],
          outputs: [],
        },
      ],
      resume: { supported: false, reason: "Reconcile the provider before retrying." },
    };

    render(
      <TaskStageEvidence
        plan={plan}
        runHref={(conversationId, runId) => `/chat/${conversationId}?run=${runId}`}
        outputHref={(outputId) => `/outputs/${outputId}`}
      />,
    );

    expect(screen.getByText("Proposed")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run run-1" }).getAttribute("href")).toBe(
      "/chat/conversation-1?run=run-1",
    );
    expect(screen.getByRole("link", { name: "Draft report" }).getAttribute("href")).toBe(
      "/outputs/output-1",
    );
    expect(screen.getByText(/Reconcile the provider/)).toBeTruthy();
    expect(screen.getByText("unknown usage · consumption unknown · released")).toBeTruthy();
  });
});
