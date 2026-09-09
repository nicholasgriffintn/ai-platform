import {
  creditMicrosFromCredits,
  type ProjectTaskPlanEvidence,
} from "@ngriffin_uk/polychat-schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { TaskCreditSummary } from "./TaskCreditSummary";

afterEach(cleanup);

it.each([
  { credits: [null], running: true, total: null, band: null, missing: false },
  { credits: [0], running: false, total: "0", band: "Everyday ask", missing: false },
  { credits: [0.2, 0.3], running: true, total: "0.5", band: "Everyday ask", missing: false },
  { credits: [0.2, 0.3, null], running: false, total: "0.5", band: "Everyday ask", missing: true },
  { credits: [10, 15], running: false, total: "25", band: "Big build", missing: false },
])("reports task spend honestly for $credits", ({ credits, running, total, band, missing }) => {
  const plan: ProjectTaskPlanEvidence = {
    protocolVersion: 1,
    id: "plan-1",
    status: running ? "active" : "completed",
    resume: { supported: false, reason: "Finished" },
    stages: [
      {
        id: "stage-1",
        flowStageId: null,
        name: "Research",
        status: running ? "executing" : "completed",
        input: { objective: "Validate release evidence", acceptanceCriterionIds: [] },
        completionIds: [],
        outputs: [],
        attempts: credits.map((value, index) => ({
          id: `attempt-${index}`,
          runId: `run-${index}`,
          conversationId: "conversation-1",
          attempt: 1,
          status: "succeeded",
          startedAt: null,
          completedAt: null,
          terminalReason: null,
          completionIds: [],
          outputs: [],
          provenance: {
            protocolVersion: 1,
            capturedAt: "2026-09-08T12:00:00.000Z",
            completeness: "partial",
            origin: "unknown",
            run: null,
            model: null,
            sources: [],
            skills: [],
            approvals: [],
          },
          usage: {
            protocolVersion: 1,
            runId: `run-${index}`,
            currentAttempt: 1,
            measurement: value === null ? "unknown" : "reported",
            reservation: null,
            consumption: {
              status: value === null ? "unknown" : "recorded",
              eventCount: value === null ? 0 : 1,
              costMicros: null,
              creditMicros: value === null ? null : creditMicrosFromCredits(value),
              estimatedPriceEventCount: 0,
              bySource: [],
            },
            attempts: [],
            settlement: { status: value === null ? "pending" : "settled", at: null },
          },
        })),
      },
    ],
  };
  const { container } = render(<TaskCreditSummary plan={plan} />);

  if (total === null) {
    expect(container.textContent).toBe("");

    return;
  }

  expect(screen.getByText(`${total} credits`)).toBeTruthy();
  expect(screen.getByText(running ? "so far" : "in total")).toBeTruthy();
  expect(band && screen.getByText(band)).toBeTruthy();
  expect(Boolean(screen.queryByText("Some attempts have not reported yet."))).toBe(missing);
});
