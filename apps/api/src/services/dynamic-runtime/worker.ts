import type { ServiceContext } from "~/lib/context/serviceContext";
import type {
	DynamicWorkerCapability,
	DynamicWorkerExecuteRequest,
	SandboxTrustLevel,
} from "@assistant/schemas";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateJwtToken } from "~/services/auth/jwt";

const DYNAMIC_RUNTIME_TOKEN_EXPIRATION_SECONDS = 60 * 60;

export interface ExecuteDynamicRuntimeWorkerOptions {
	env: IEnv;
	context: ServiceContext;
	user: IUser;
	runId: string;
	task: string;
	code?: string;
	model?: string;
	trustLevel?: SandboxTrustLevel;
	timeoutSeconds?: number;
	capabilities?: DynamicWorkerCapability[];
	stream?: boolean;
	signal?: AbortSignal;
}

function resolveApiBaseUrl(env: IEnv): string {
	const apiBaseUrl = env.API_BASE_URL?.trim();
	return apiBaseUrl || "https://api.polychat.app";
}

export async function executeDynamicRuntimeWorker(
	options: ExecuteDynamicRuntimeWorkerOptions,
): Promise<Response> {
	const {
		env,
		user,
		runId,
		task,
		code,
		model,
		trustLevel,
		timeoutSeconds,
		capabilities,
		stream,
		signal,
	} = options;

	if (!env.DYNAMIC_RUNTIME_WORKER) {
		throw new AssistantError(
			"Dynamic runtime worker not available",
			ErrorType.NOT_FOUND,
		);
	}
	if (!env.JWT_SECRET) {
		throw new AssistantError(
			"JWT secret not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	const dynamicToken = await generateJwtToken(
		user,
		env.JWT_SECRET,
		DYNAMIC_RUNTIME_TOKEN_EXPIRATION_SECONDS,
	);

	const workerPayload: DynamicWorkerExecuteRequest = {
		userId: user.id,
		runId,
		task,
		code,
		model,
		trustLevel,
		timeoutSeconds,
		capabilities: capabilities ?? ["echo", "clock"],
		polychatApiUrl: resolveApiBaseUrl(env),
	};

	return env.DYNAMIC_RUNTIME_WORKER.fetch(
		new Request("http://dynamic-runtime/execute-dynamic", {
			method: "POST",
			signal,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${dynamicToken}`,
				...(stream ? { Accept: "text/event-stream" } : {}),
			},
			body: JSON.stringify(workerPayload),
		}),
	);
}
