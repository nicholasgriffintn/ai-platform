import { workAttentionResponseSchema } from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL } from "../support/environment";

export class WorkAttentionApi {
  constructor(private readonly request: APIRequestContext) {}

  async list(query: Record<string, string | number> = {}) {
    const response = await this.request.get(`${E2E_API_BASE_URL}/workspaces/attention`, {
      params: query,
    });

    await requireSuccessfulResponse(response, "Read work attention");

    return workAttentionResponseSchema.parse(await response.json());
  }

  async occurredAtByTitle(query: Record<string, string | number> = {}) {
    const { items } = await this.list(query);

    return new Map(items.map((item) => [item.title, item.occurredAt]));
  }
}
