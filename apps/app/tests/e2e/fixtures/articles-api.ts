import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

export interface AnalysedArticle {
  outputId: string;
  itemId: string;
  model: string;
}

export class ArticlesApi {
  constructor(private readonly request: APIRequestContext) {}

  async analyse(input: { article: string; itemId: string; projectId?: string }) {
    const query = input.projectId ? `?projectId=${input.projectId}` : "";
    const response = await this.request.post(`${E2E_API_BASE_URL}/apps/articles/analyse${query}`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { article: input.article, itemId: input.itemId },
    });

    await requireSuccessfulResponse(response, "Analyse article");
    const body = (await response.json()) as {
      outputId: string;
      itemId: string;
      analysis?: { data?: { model?: string } };
    };
    const model = body.analysis?.data?.model;

    if (!body.outputId || typeof model !== "string") {
      throw new Error("The analysis did not report the output it saved and the model it used");
    }

    return { outputId: body.outputId, itemId: body.itemId, model } satisfies AnalysedArticle;
  }

  async listStatus(projectId?: string) {
    const query = projectId ? `?projectId=${projectId}` : "";

    return (await this.request.get(`${E2E_API_BASE_URL}/apps/articles${query}`)).status();
  }

  async listBody(projectId?: string) {
    const query = projectId ? `?projectId=${projectId}` : "";
    const response = await this.request.get(`${E2E_API_BASE_URL}/apps/articles${query}`);

    await requireSuccessfulResponse(response, "Read articles");

    return response.text();
  }
}
