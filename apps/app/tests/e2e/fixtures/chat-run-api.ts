import {
  chatRunReplayResponseSchema,
  chatRunSnapshotResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

export class ChatRunApi {
  constructor(private readonly request: APIRequestContext) {}

  async snapshot(runId: string) {
    const response = await this.request.get(`${E2E_API_BASE_URL}/chat/runs/${runId}/snapshot`);

    await requireSuccessfulResponse(response, "Read run snapshot");

    return chatRunSnapshotResponseSchema.parse(await response.json());
  }

  async events(runId: string, after: number) {
    const response = await this.request.get(`${E2E_API_BASE_URL}/chat/runs/${runId}/events`, {
      params: { after },
    });

    await requireSuccessfulResponse(response, "Read run events");

    return chatRunReplayResponseSchema.parse(await response.json());
  }

  async cancelStatus(runId: string, expectedAttempt: number, commandId: string) {
    return (
      await this.request.post(`${E2E_API_BASE_URL}/chat/runs/${runId}/cancel`, {
        headers: { origin: E2E_APP_BASE_URL },
        data: { command_id: commandId, expected_attempt: expectedAttempt },
      })
    ).status();
  }
}
