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
  type SandboxDeliveryPolicy,
} from "@ngriffin_uk/polychat-schemas";
import type { APIRequestContext } from "@playwright/test";

import { requireSuccessfulResponse } from "../support/api-response";
import { E2E_API_BASE_URL, E2E_APP_BASE_URL } from "../support/environment";

export const SANDBOX_E2E_REPOSITORIES = {
  base: "nicholasgriffintn/polychat-e2e-fixture",
  revised: "nicholasgriffintn/polychat-e2e-fixture-v2",
  malformed: "nicholasgriffintn/polychat-e2e-fixture-malformed",
  oversized: "nicholasgriffintn/polychat-e2e-fixture-oversized",
  delivery: "nicholasgriffintn/polychat-e2e-delivery",
  deliveryPullRequestFailure: "nicholasgriffintn/polychat-e2e-delivery-pr-failure",
  deliveryDefaultBranch: "nicholasgriffintn/polychat-e2e-delivery-default-branch",
  deliveryProtected: "nicholasgriffintn/polychat-e2e-delivery-protected",
  deliveryProtectionChange: "nicholasgriffintn/polychat-e2e-delivery-protection-change",
};
const REPOSITORY = SANDBOX_E2E_REPOSITORIES.base;
const REPOSITORIES = Object.values(SANDBOX_E2E_REPOSITORIES);
const INSTALLATION_ID = 987654;

export class SandboxApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly projectId: string,
  ) {}

  async configureProject(
    environmentSetup?: SandboxEnvironmentSetup,
    timeoutSeconds = 120,
    repository = REPOSITORY,
    deliveryPolicy: SandboxDeliveryPolicy = { mode: "leave_uncommitted" },
    installationId = INSTALLATION_ID,
  ) {
    await this.connectInstallation(installationId);
    const project = await this.saveEnvironment(
      environmentSetup,
      timeoutSeconds,
      repository,
      deliveryPolicy,
      installationId,
    );

    await requireSuccessfulResponse(project, "Configure the fixture coding environment");
  }

  async connectInstallation(installationId = INSTALLATION_ID) {
    const connection = await this.request.post(
      `${E2E_API_BASE_URL}/apps/sandbox/connections/auto`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: { installationId, repositories: REPOSITORIES },
      },
    );

    await requireSuccessfulResponse(connection, "Connect the fixture GitHub installation");
  }

  async saveEnvironment(
    environmentSetup?: SandboxEnvironmentSetup,
    timeoutSeconds = 120,
    repository = REPOSITORY,
    deliveryPolicy: SandboxDeliveryPolicy = { mode: "leave_uncommitted" },
    installationId = INSTALLATION_ID,
  ) {
    return this.request.put(`${E2E_API_BASE_URL}/projects/${this.projectId}`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: {
        codingEnvironment: {
          installationId,
          repository,
          deliveryPolicy,
          timeoutSeconds,
          environmentSetup,
        },
      },
    });
  }

  async removeCodingEnvironment() {
    const response = await this.request.put(`${E2E_API_BASE_URL}/projects/${this.projectId}`, {
      headers: { origin: E2E_APP_BASE_URL },
      data: { codingEnvironment: null },
    });

    await requireSuccessfulResponse(response, "Remove the fixture coding environment");
  }

  async replaceConnectionRepositories(repositories: string[], installationId = INSTALLATION_ID) {
    const response = await this.request.put(
      `${E2E_API_BASE_URL}/apps/sandbox/connections/${installationId}/repositories`,
      {
        headers: { origin: E2E_APP_BASE_URL },
        data: { repositories },
      },
    );

    await requireSuccessfulResponse(response, "Replace fixture repository authority");
  }

  async redeliverRun(runId: string) {
    const response = await this.request.post(`${E2E_API_BASE_URL}/__e2e-sandbox-redelivery`, {
      data: { runId },
    });

    await requireSuccessfulResponse(response, "Redeliver terminal sandbox task");
  }

  async createQueuedWorkbenchRun(conversationId: string, task: string) {
    const response = await this.request.post(`${E2E_API_BASE_URL}/__e2e-workbench-run`, {
      data: { projectId: this.projectId, conversationId, task },
    });

    await requireSuccessfulResponse(response, "Create queued Workbench fixture");

    return sandboxRunDataSchema.parse(await response.json());
  }

  async deleteQueuedWorkbenchRun(runId: string) {
    const response = await this.request.delete(`${E2E_API_BASE_URL}/__e2e-workbench-run`, {
      params: { runId },
    });

    await requireSuccessfulResponse(response, "Delete queued Workbench fixture");
  }

  async redeliveryState(runId: string): Promise<string | undefined> {
    const response = await this.request.get(`${E2E_API_BASE_URL}/__e2e-sandbox-redelivery`, {
      params: { runId },
    });

    if (!response.ok()) {
      return undefined;
    }

    const body: unknown = await response.json();

    return body && typeof body === "object" && "status" in body && typeof body.status === "string"
      ? body.status
      : undefined;
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

  async previewAccess(runId: string, previewId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/previews/${previewId}`,
    );

    await requireSuccessfulResponse(response, "Read sandbox preview access");

    return sandboxPreviewAccessSchema.parse(await response.json());
  }

  async previewAccessStatus(runId: string, previewId: string) {
    const response = await this.request.get(
      `${E2E_API_BASE_URL}/apps/sandbox/runs/${runId}/previews/${previewId}`,
    );

    return response.status();
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
