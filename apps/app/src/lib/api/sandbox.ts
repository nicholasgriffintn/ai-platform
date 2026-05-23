import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";
import type {
	ConnectSandboxInstallationInput,
	CreateSandboxConnectionInput,
	SandboxConnection,
	SandboxConnectionRepositoriesPayload,
	SandboxInstallConfig,
	SandboxRunInstruction,
	SandboxRunInstructionKind,
} from "~/types/sandbox";

async function extractApiErrorMessage(response: Response, fallback: string): Promise<string> {
	const bodyText = await response.text();
	if (!bodyText.trim()) {
		return fallback;
	}

	try {
		const parsed = JSON.parse(bodyText) as {
			error?: string;
			message?: string;
			details?: unknown;
		};
		const topLevelMessage = parsed.error || parsed.message;
		if (topLevelMessage?.trim()) {
			return topLevelMessage;
		}

		if (Array.isArray(parsed.details) && parsed.details.length > 0) {
			const firstDetail = parsed.details[0] as { message?: unknown };
			if (typeof firstDetail?.message === "string" && firstDetail.message.trim()) {
				return firstDetail.message;
			}
		}
	} catch {
		// Fall back to plain text body.
	}

	return bodyText;
}

export async function fetchSandboxConnections(): Promise<SandboxConnection[]> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi("/apps/sandbox/connections", {
		method: "GET",
		headers,
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox connections: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox install configuration: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to save sandbox connection: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to connect GitHub installation: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to fetch sandbox repositories: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to update sandbox repositories: ${response.statusText}`,
			),
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
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to delete sandbox connection: ${response.statusText}`,
			),
		);
	}
}

export async function submitSandboxRunInstruction(params: {
	runId: string;
	kind?: SandboxRunInstructionKind;
	content?: string;
	command?: string;
	requestId?: string;
	approvalStatus?: "approved" | "rejected";
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction> {
	const headers = await apiService.getHeaders();
	const response = await fetchApi(`/apps/sandbox/runs/${params.runId}/instructions`, {
		method: "POST",
		headers,
		body: {
			kind: params.kind ?? "message",
			content: params.content,
			command: params.command,
			requestId: params.requestId,
			approvalStatus: params.approvalStatus,
			timeoutSeconds: params.timeoutSeconds,
			escalateAfterSeconds: params.escalateAfterSeconds,
		},
	});

	if (!response.ok) {
		throw new Error(
			await extractApiErrorMessage(
				response,
				`Failed to submit run instruction: ${response.statusText}`,
			),
		);
	}

	const data = await returnFetchedData<{ instruction?: SandboxRunInstruction }>(response);
	if (!data.instruction) {
		throw new Error("Submitted instruction was not returned");
	}
	return data.instruction;
}
