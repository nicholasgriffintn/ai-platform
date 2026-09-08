import {
  outputHistoryResponseSchema,
  outputSchema,
  type CreateOutputInput,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

export class OutputApi {
  constructor(private readonly request: APIRequestContext) {}

  async create(input: CreateOutputInput) {
    const response = await this.request.post(`${E2E_API_BASE_URL}/outputs`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: input,
    });

    await requireSuccessfulResponse(response, "Create output");

    return outputSchema.parse(await response.json());
  }

  async history(outputId: string) {
    const response = await this.request.get(`${E2E_API_BASE_URL}/outputs/${outputId}/revisions`);

    await requireSuccessfulResponse(response, "Read output history");

    return outputHistoryResponseSchema.parse(await response.json());
  }

  async historyStatus(outputId: string) {
    return (await this.request.get(`${E2E_API_BASE_URL}/outputs/${outputId}/revisions`)).status();
  }

  async documentActionStatus(
    outputId: string,
    action: "describe" | "format",
    data: Record<string, unknown>,
  ) {
    return (
      await this.request.post(`${E2E_API_BASE_URL}/outputs/${outputId}/${action}`, {
        headers: { origin: E2E_APP_BASE_URL },
        data,
      })
    ).status();
  }

  async restoreStatus(outputId: string, revision: number, expectedRevision: number) {
    return (
      await this.request.post(
        `${E2E_API_BASE_URL}/outputs/${outputId}/revisions/${revision}/restore`,
        {
          headers: { origin: E2E_APP_BASE_URL },
          data: { expectedRevision },
        },
      )
    ).status();
  }
}
