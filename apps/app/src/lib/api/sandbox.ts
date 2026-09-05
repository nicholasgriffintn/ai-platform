import {
  createApiErrorFromResponse,
  returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";
import type {
  ConnectSandboxInstallationInput,
  CreateSandboxPreviewRequest,
  CreateSandboxConnectionInput,
  SandboxConnection,
  SandboxConnectionRepositoriesPayload,
  SandboxInstallConfig,
  SandboxPreviewAccess,
  SandboxRunControl,
  SandboxRunEventEnvelope,
  SandboxRunInstruction,
  SandboxRunInstructionEnvelope,
  SandboxRunInstructionKind,
  SandboxServiceAction,
  UpdateSandboxRunControl,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper";

export async function fetchSandboxConnections(): Promise<SandboxConnection[]> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi("/apps/sandbox/connections", {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(
      response,
      `Failed to fetch sandbox connections: ${response.statusText}`,
    );
  }

  const data = await returnFetchedData<{ connections: SandboxConnection[] }>(response);

  return data.connections ?? [];
}

export async function fetchSandboxInstallConfig(): Promise<SandboxInstallConfig> {
  const headers = await apiService.getHeaders();
  const response = await fetchApi("/apps/sandbox/github/install-config", {
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
  const response = await fetchApi("/apps/sandbox/connections", {
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
  const response = await fetchApi("/apps/sandbox/connections/auto", {
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
  const response = await fetchApi(`/apps/sandbox/connections/${installationId}/repositories`, {
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
  const response = await fetchApi(`/apps/sandbox/connections/${installationId}/repositories`, {
    method: "PUT",
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
  const response = await fetchApi(`/apps/sandbox/connections/${installationId}`, {
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
  const response = await fetchApi(`/apps/sandbox/runs/${params.runId}/instructions`, {
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

  const data = await returnFetchedData<{ instruction?: SandboxRunInstruction }>(response);

  if (!data.instruction) {
    throw new Error("Submitted instruction was not returned");
  }

  return data.instruction;
}

export async function fetchSandboxRunEvents(runId: string): Promise<SandboxRunEventEnvelope[]> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/events`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });
  const data = await returnFetchedData<{ events?: SandboxRunEventEnvelope[] }>(response);

  return data.events ?? [];
}

export async function fetchSandboxRunInstructions(
  runId: string,
): Promise<SandboxRunInstructionEnvelope[]> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/instructions`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });
  const data = await returnFetchedData<{ instructions?: SandboxRunInstructionEnvelope[] }>(
    response,
  );

  return data.instructions ?? [];
}

export async function fetchSandboxRunControl(runId: string): Promise<SandboxRunControl> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/control`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<SandboxRunControl>(response);
}

export async function updateSandboxRunControl(
  runId: string,
  input: UpdateSandboxRunControl,
): Promise<SandboxRunControl> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/control`, {
    method: "PATCH",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return returnFetchedData<SandboxRunControl>(response);
}

export async function createSandboxPreview(
  runId: string,
  input: CreateSandboxPreviewRequest,
): Promise<SandboxPreviewAccess> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/previews`, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });

  return returnFetchedData<SandboxPreviewAccess>(response);
}

export async function fetchSandboxPreview(
  runId: string,
  previewId: string,
): Promise<SandboxPreviewAccess> {
  const response = await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/previews/${previewId}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<SandboxPreviewAccess>(response);
}

export async function revokeSandboxPreview(runId: string, previewId: string): Promise<void> {
  await fetchApiOrThrow(`/apps/sandbox/runs/${runId}/previews/${previewId}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
