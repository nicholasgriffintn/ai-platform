import {
  activityListResponseSchema,
  sandboxRunDataSchema,
  sandboxRunEventEnvelopeSchema,
  sandboxRunControlSchema,
  sandboxRunInstructionEnvelopeSchema,
  sandboxPreviewAccessSchema,
  projectDetailSchema,
  SANDBOX_RUNS_CAPABILITY_ID,
  type SandboxEnvironmentSetup,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

const REPOSITORY = "nicholasgriffintn/polychat-e2e-fixture";
const INSTALLATION_ID = 987654;

export class SandboxApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly projectId: string,
  ) {}

  async configureProject(environmentSetup?: SandboxEnvironmentSetup, timeoutSeconds = 120) {
    const connection = await this.request.post(
      `${E2E_API_BASE_URL}/apps/sandbox/connections/auto`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: { installationId: INSTALLATION_ID, repositories: [REPOSITORY] },
      },
    );

    await requireSuccessfulResponse(connection, "Connect the fixture GitHub installation");
    const project = await this.saveEnvironment(environmentSetup, timeoutSeconds);

    await requireSuccessfulResponse(project, "Configure the fixture coding environment");
  }

  async saveEnvironment(environmentSetup?: SandboxEnvironmentSetup, timeoutSeconds = 120) {
    return this.request.put(`${E2E_API_BASE_URL}/projects/${this.projectId}`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        codingEnvironment: {
          installationId: INSTALLATION_ID,
          repository: REPOSITORY,
          deliveryPolicy: { mode: "leave_uncommitted" },
          timeoutSeconds,
          environmentSetup,
        },
      },
    });
  }

  async latestRun() {
    const response = await this.request.get(`${E2E_API_BASE_URL}/activity`, {
      params: { projectId: this.projectId, capabilityId: SANDBOX_RUNS_CAPABILITY_ID },
    });

    await requireSuccessfulResponse(response, "Read sandbox activity");
    const result = activityListResponseSchema.parse(await response.json());
    const activity = result.activities[0];

    return activity ? sandboxRunDataSchema.parse(activity.data) : null;
  }

  async project() {
    const response = await this.request.get(`${E2E_API_BASE_URL}/projects/${this.projectId}`);

    await requireSuccessfulResponse(response, "Read coding project");

    return projectDetailSchema.parse(await response.json());
  }

  async artifact(url: string) {
    const response = await this.request.get(new URL(url, E2E_API_BASE_URL).href);

    await requireSuccessfulResponse(response, "Read persisted sandbox artifact");

    return response.text();
  }

  async events(runId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/events`,
    );

    await requireSuccessfulResponse(response, "Read sandbox run events");

    return sandboxRunEventEnvelopeSchema.array().parse((await response.json()).events);
  }

  async control(runId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/control`,
    );

    await requireSuccessfulResponse(response, "Read sandbox control");

    return sandboxRunControlSchema.parse(await response.json());
  }

  async createPreview(runId: string, serviceName: string) {
    return this.request.post(`${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/previews`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { serviceName },
    });
  }

  async preview(runId: string, serviceName: string) {
    const response = await this.createPreview(runId, serviceName);

    await requireSuccessfulResponse(response, "Create declared service preview");

    return sandboxPreviewAccessSchema.parse(await response.json());
  }

  async revokePreview(runId: string, previewId: string) {
    const response = await this.request.delete(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/previews/${previewId}`,
      { headers: { origin: E2E_APP_BASE_URL } },
    );

    await requireSuccessfulResponse(response, "Revoke service preview");
  }

  async authorisePreviewWithoutServicePrincipal(credential: string, originId: string) {
    return this.request.post(`${E2E_API_BASE_URL}/apps/sandbox/previews/authorise`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { credential, originId, mode: "bootstrap" },
    });
  }

  async instructions(runId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/instructions`,
    );

    await requireSuccessfulResponse(response, "Read sandbox instructions");

    return sandboxRunInstructionEnvelopeSchema.array().parse((await response.json()).instructions);
  }

  async submitInstruction(runId: string, idempotencyKey: string, content: string) {
    return this.request.post(`${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/instructions`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { kind: "message", idempotencyKey, content },
    });
  }

  async respondToApproval(
    runId: string,
    requestId: string,
    approvalStatus: "approved" | "rejected",
    idempotencyKey: string,
  ) {
    return this.request.post(`${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/instructions`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { kind: "approval_response", requestId, approvalStatus, idempotencyKey },
    });
  }

  async submitServiceAction(
    runId: string,
    serviceName: string,
    serviceAction: "start" | "stop" | "restart",
    idempotencyKey: string,
  ) {
    return this.request.post(`${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/instructions`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { kind: "service_action", serviceName, serviceAction, idempotencyKey },
    });
  }

  async updateControl(
    runId: string,
    action: "pause" | "resume" | "cancel",
    expectedUpdatedAt: string,
  ) {
    return this.request.patch(`${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/control`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { action, expectedUpdatedAt },
    });
  }
}
