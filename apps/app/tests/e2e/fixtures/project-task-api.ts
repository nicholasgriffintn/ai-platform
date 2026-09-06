import {
  projectTaskDetailResponseSchema,
  projectTaskResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

export class ProjectTaskApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly projectId: string,
  ) {}

  async createQuestionTask() {
    const response = await this.request.post(
      `${E2E_API_BASE_URL}/projects/${this.projectId}/tasks`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: {
          objective: "Ask questions for the release check",
          runner: { kind: "conversation", model: "groq-openai-gpt-oss-120b", mode: "build" },
          acceptanceCriteria: [
            { text: "Collect the audience and scope before writing the report." },
          ],
        },
      },
    );

    await requireSuccessfulResponse(response, "Create project question task");

    return projectTaskResponseSchema.parse(await response.json()).task;
  }

  async detail(taskId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/projects/${this.projectId}/tasks/${taskId}`,
    );

    await requireSuccessfulResponse(response, "Read project task");

    return projectTaskDetailResponseSchema.parse(await response.json());
  }
}
