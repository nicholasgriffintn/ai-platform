import type { PlatformResponse, ResponseStatus } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getResponseLoadingMessage,
  getResponsePresentation,
} from "../../../chat/response-presentation.js";

function response(status: ResponseStatus): PlatformResponse {
  return {
    object: "response",
    id: "resp-1",
    conversation_id: "conversation-1",
    status,
    waiting_on: null,
    attempt: 1,
    trigger: "user",
    initiator_user_id: 7,
    project_id: null,
    project_task_id: null,
    created_at: "2026-09-05T12:00:00.000Z",
    updated_at: "2026-09-05T12:00:01.000Z",
    started_at: "2026-09-05T12:00:01.000Z",
    completed_at: null,
    terminal_reason: status === "failed" ? "Provider unavailable" : null,
    last_item_id: null,
  };
}

describe("getResponsePresentation", () => {
  it("shows a scheduled model retry without pretending the attempt changed", () => {
    expect(
      getResponsePresentation({
        ...response("in_progress"),
        retry: {
          protocolVersion: 1,
          step: 2,
          attempt: 2,
          maxAttempts: 2,
          runRetry: 1,
          maxRunRetries: 2,
          phase: "waiting",
          classification: "timeout",
          reason: "The model provider did not respond in time.",
          scheduledAt: "2026-09-05T12:00:02.000Z",
          retryAt: "2026-09-05T12:00:03.000Z",
        },
      }),
    ).toMatchObject({ label: "Retry scheduled", tone: "attention" });
  });

  it("explains failures with the terminal reason", () => {
    expect(getResponsePresentation(response("failed"))).toEqual({
      label: "Task failed",
      detail: "Provider unavailable",
      tone: "danger",
    });
  });

  it("maps every status to a loading message", () => {
    const statuses: ResponseStatus[] = [
      "queued",
      "in_progress",
      "awaiting_input",
      "awaiting_approval",
      "awaiting_takeover",
      "cancelling",
      "completed",
      "failed",
      "cancelled",
      "incomplete",
    ];

    for (const status of statuses) {
      expect(getResponseLoadingMessage(status)).not.toBe("Task status unavailable.");
    }
  });
});
