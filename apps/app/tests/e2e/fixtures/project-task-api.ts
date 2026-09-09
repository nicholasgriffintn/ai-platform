import {
  projectTaskDetailResponseSchema,
  projectTaskResponseSchema,
  type ProjectTaskStatus,
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

  async create(objective: string) {
    const response = await this.request.post(
      `${E2E_API_BASE_URL}/projects/${this.projectId}/tasks`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: { objective },
      },
    );

    await requireSuccessfulResponse(response, "Create project task");

    return projectTaskResponseSchema.parse(await response.json()).task;
  }

  async setStatus(taskId: string, status: ProjectTaskStatus) {
    const response = await this.request.patch(
      `${E2E_API_BASE_URL}/projects/${this.projectId}/tasks/${taskId}`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: { status },
      },
    );

    await requireSuccessfulResponse(response, "Update project task status");

    return projectTaskResponseSchema.parse(await response.json()).task;
  }

  async createWithStatus(objective: string, status: ProjectTaskStatus) {
    const task = await this.create(objective);

    return this.setStatus(task.id, status);
  }

  async detail(taskId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/projects/${this.projectId}/tasks/${taskId}`,
    );

    await requireSuccessfulResponse(response, "Read project task");

    return projectTaskDetailResponseSchema.parse(await response.json());
  }

  async detailStatus(taskId: string) {
    return (
      await this.request.get(`${E2E_API_BASE_URL}/projects/${this.projectId}/tasks/${taskId}`)
    ).status();
  }
}
