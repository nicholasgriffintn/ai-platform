import type {
	RealtimePipelineSessionCreate,
	RealtimePipelineSessionResponse,
} from "@assistant/schemas";
import { realtimeSessionResponseSchema } from "@assistant/schemas";

import { getRealtimeProvider } from "~/lib/providers/capabilities/realtime";
import { generateId } from "~/utils/id";
import type { IEnv, IUser } from "~/types";
import { getAccessibleRealtimeModel } from "./access";

type PipelineStageName = "Input" | "Reasoning" | "Output";

async function validatePipelineStage({
	env,
	model,
	name,
	provider,
	user,
}: {
	env: IEnv;
	model: string;
	name: PipelineStageName;
	provider: string;
	user: IUser;
}): Promise<{ message: string; status: 400 | 403 } | undefined> {
	const accessibleModel = await getAccessibleRealtimeModel({
		env,
		model,
		userId: user.id,
	});

	if (!accessibleModel) {
		return {
			message: `${name} model not found or user does not have access`,
			status: 403,
		};
	}

	if (accessibleModel.provider !== provider) {
		return {
			message: `${name} model does not belong to ${provider}`,
			status: 400,
		};
	}

	return undefined;
}

export async function createRealtimePipelineSession({
	env,
	request,
	user,
}: {
	env: IEnv;
	request: RealtimePipelineSessionCreate;
	user: IUser;
}): Promise<
	| { ok: true; session: RealtimePipelineSessionResponse }
	| { ok: false; message: string; status: 400 | 403 }
> {
	const stageError =
		(await validatePipelineStage({
			env,
			model: request.input.model,
			name: "Input",
			provider: request.input.provider,
			user,
		})) ??
		(await validatePipelineStage({
			env,
			model: request.reasoning.model,
			name: "Reasoning",
			provider: request.reasoning.provider,
			user,
		})) ??
		(await validatePipelineStage({
			env,
			model: request.output.model,
			name: "Output",
			provider: request.output.provider,
			user,
		}));

	if (stageError) {
		return { ok: false, message: stageError.message, status: stageError.status };
	}

	const realtimeProvider = getRealtimeProvider(request.input.provider, { env, user });
	const rawInputSession = await realtimeProvider.createSession({
		delay: request.delay,
		env,
		language: request.language,
		model: request.input.model,
		outputModalities: ["text"],
		inputModalities: ["audio"],
		transport: "websocket",
		type: "transcription",
		user,
	});
	const inputSession = realtimeSessionResponseSchema.parse(rawInputSession);

	return {
		ok: true,
		session: {
			id: generateId(),
			object: "realtime.pipeline.session",
			type: "pipeline",
			live_mode: "composed",
			input: {
				...request.input,
				session: inputSession,
			},
			reasoning: request.reasoning,
			output: request.output,
			latency_profile: request.latency_profile ?? "balanced",
		},
	};
}
