import {
  sandboxRunInstructionSchema,
  type ConnectSandboxInstallationInput,
  type CreateSandboxPreviewRequest,
  type CreateSandboxConnectionInput,
  type SandboxConnection,
  type SandboxConnectionRepositoriesPayload,
  type SandboxInstallConfig,
  type SandboxPreviewAccess,
  type SandboxRunControl,
  type SandboxRunEventEnvelope,
  type SandboxRunInstruction,
  type SandboxRunInstructionEnvelope,
  type SandboxRunInstructionKind,
  type SandboxServiceAction,
  type UpdateSandboxRunControl,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { actOnEnvironment, environmentPath, environments } from "./environments.js";
import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";
import { requestJson, resource } from "./resource.js";

export function fetchSandboxConnections(): Promise<SandboxConnection[]> {
  return resource<SandboxConnection>("/connections/github").listAll();
}

export async function fetchSandboxInstallConfig(): Promise<SandboxInstallConfig> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi("/connections/github/install_config", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to fetch sandbox install configuration: ${response.statusText}`,
    );
  }

  return returnFetchedData<SandboxInstallConfig>(response);
}

export async function upsertSandboxConnection(input: CreateSandboxConnectionInput): Promise<void> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi("/connections/github", {
    method: "POST",
    headers,
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to save sandbox connection: ${response.statusText}`,
    );
  }
}

export async function connectSandboxInstallation(
  input: ConnectSandboxInstallationInput,
): Promise<void> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi("/connections/github/auto_connect", {
    method: "POST",
    headers,
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to connect GitHub installation: ${response.statusText}`,
    );
  }
}

export async function fetchSandboxConnectionRepositories(
  installationId: number,
): Promise<string[]> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi(`/connections/github/${installationId}/repositories`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to fetch sandbox repositories: ${response.statusText}`,
    );
  }

  const data = await returnFetchedData<{ repositories: string[] }>(response);

  return data.repositories ?? [];
}

export async function updateSandboxConnectionRepositories(
  installationId: number,
  input: SandboxConnectionRepositoriesPayload,
): Promise<void> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi(`/connections/github/${installationId}/repositories`, {
    method: "PATCH",
    headers,
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to update sandbox repositories: ${response.statusText}`,
    );
  }
}

export async function deleteSandboxConnection(installationId: number): Promise<void> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi(`/connections/github/${installationId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to delete sandbox connection: ${response.statusText}`,
    );
  }
}

export async function submitSandboxRunInstruction(params: {
  runId: string;
  kind?: SandboxRunInstructionKind;
  idempotencyKey: string;
  content?: string;
  command?: string;
  requestId?: string;
  approvalStatus?: "approved" | "rejected";
  serviceName?: string;
  serviceAction?: SandboxServiceAction;
  timeoutSeconds?: number;
  escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi(environmentPath(params.runId, "/instructions"), {
    method: "POST",
    headers,
    body: {
      kind: params.kind ?? "message",
      idempotencyKey: params.idempotencyKey,
      content: params.content,
      command: params.command,
      requestId: params.requestId,
      approvalStatus: params.approvalStatus,
      serviceName: params.serviceName,
      serviceAction: params.serviceAction,
      timeoutSeconds: params.timeoutSeconds,
      escalateAfterSeconds: params.escalateAfterSeconds,
    },
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to submit run instruction: ${response.statusText}`,
    );
  }

  return sandboxRunInstructionSchema.parse(await returnFetchedData<unknown>(response));
}

export async function fetchSandboxRunEvents(runId: string): Promise<SandboxRunEventEnvelope[]> {
  return environments.sub<SandboxRunEventEnvelope>(runId, "events").listAll();
}

export async function fetchSandboxRunInstructions(
  runId: string,
): Promise<SandboxRunInstructionEnvelope[]> {
  return environments.sub<SandboxRunInstructionEnvelope>(runId, "instructions").listAll();
}

export async function fetchSandboxRunControl(runId: string): Promise<SandboxRunControl> {
  return environments.singleton<SandboxRunControl>(runId, "control").get();
}

export async function updateSandboxRunControl(
  runId: string,
  input: UpdateSandboxRunControl,
): Promise<SandboxRunControl> {
  const { action, reason, extensionSeconds, expectedUpdatedAt } = input;

  return actOnEnvironment<SandboxRunControl>(
    runId,
    action === "extend_inspection"
      ? { action, extension_seconds: extensionSeconds, expected_updated_at: expectedUpdatedAt }
      : { action, reason, expected_updated_at: expectedUpdatedAt },
    "sandbox",
  );
}

export async function createSandboxPreview(
  runId: string,
  input: CreateSandboxPreviewRequest,
): Promise<SandboxPreviewAccess> {
  return requestJson<SandboxPreviewAccess>(environmentPath(runId, "/previews"), "POST", input);
}

export async function fetchSandboxPreview(
  runId: string,
  previewId: string,
): Promise<SandboxPreviewAccess> {
  return requestJson<SandboxPreviewAccess>(
    environmentPath(runId, `/previews/${encodeURIComponent(previewId)}`),
    "GET",
  );
}

export async function revokeSandboxPreview(runId: string, previewId: string): Promise<void> {
  await requestJson<unknown>(
    environmentPath(runId, `/previews/${encodeURIComponent(previewId)}`),
    "DELETE",
  );
}
