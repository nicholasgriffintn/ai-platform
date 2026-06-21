import { AwsClient } from "aws4fetch";

import { trackProviderMetrics } from "~/lib/monitoring";
import { getTrainingModel } from "~/lib/providers/capabilities/training/modelCatalog";
import { getSageMakerTrainingDeploymentRuntimeRecordByEndpointName } from "~/lib/providers/models/trainingDeployments";
import type { TrainingDeploymentRuntimeRecord } from "~/lib/providers/models/trainingDeployments";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	formatMessages,
	formatTextGenerationPrompt,
	stringifyMessageContent,
} from "~/utils/messages";
import { isRecord, omitNullishValues } from "~/utils/objects";
import { createTextGenerationParameters } from "~/utils/parameters";
import type { AIProvider } from "./base";

const READY_ENDPOINT_STATUSES = new Set(["inservice", "in service"]);

interface SageMakerTextGenerationResponse {
	choices?: Array<{
		message?: { content?: unknown };
		delta?: { content?: unknown };
		text?: unknown;
	}>;
	generated_text?: string;
	text?: string;
	[other: string]: unknown;
}

export class SageMakerProvider implements AIProvider {
	name = "sagemaker";
	supportsStreaming = false;

	async getResponse(params: ChatCompletionParameters, userId?: number): Promise<any> {
		const resolvedUserId = userId || params.user?.id;
		if (!resolvedUserId) {
			throw new AssistantError(
				"SageMaker training deployments require an authenticated user",
				ErrorType.AUTHENTICATION_ERROR,
				401,
			);
		}

		const endpointName = params.model;
		if (!endpointName) {
			throw new AssistantError("SageMaker endpoint name is required", ErrorType.PARAMS_ERROR);
		}

		const deployment = await getSageMakerTrainingDeploymentRuntimeRecordByEndpointName(
			params.env,
			resolvedUserId,
			endpointName,
		);
		if (!deployment) {
			throw new AssistantError("SageMaker training deployment not found", ErrorType.NOT_FOUND);
		}
		if (!READY_ENDPOINT_STATUSES.has(deployment.status.toLowerCase())) {
			throw new AssistantError(
				`SageMaker endpoint is not ready: ${deployment.status}`,
				ErrorType.PROVIDER_ERROR,
			);
		}

		return trackProviderMetrics({
			provider: this.name,
			model: endpointName,
			operation: async () => {
				const response = await this.invokeEndpoint(params, endpointName, deployment);
				return {
					response: extractSageMakerGeneratedText(response),
					usage: {
						prompt_tokens: 0,
						completion_tokens: 0,
						total_tokens: 0,
					},
					data: {
						providerResponse: response,
					},
				};
			},
			analyticsEngine: params.env?.ANALYTICS,
			settings: {},
			userId: resolvedUserId,
			completion_id: params.completion_id,
			request: params,
		});
	}

	private async invokeEndpoint(
		params: ChatCompletionParameters,
		endpointName: string,
		deployment: TrainingDeploymentRuntimeRecord,
	): Promise<unknown> {
		const region = params.env.SAGEMAKER_AWS_REGION || params.env.AWS_REGION || "us-east-1";
		const client = this.createClient(params, region);
		const response = await client.fetch(
			`https://runtime.sagemaker.${region}.amazonaws.com/endpoints/${encodeURIComponent(
				endpointName,
			)}/invocations`,
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(createSageMakerInvocationBody(params, deployment, this.name)),
			},
		);
		const text = await response.text();
		const data = text ? JSON.parse(text) : {};
		if (!response.ok) {
			const message = getSageMakerRuntimeErrorMessage(data, text);
			throw new AssistantError(message, ErrorType.PROVIDER_ERROR, response.status);
		}

		return data;
	}

	private createClient(params: ChatCompletionParameters, region: string): AwsClient {
		const accessKeyId = params.env.SAGEMAKER_AWS_ACCESS_KEY;
		const secretAccessKey = params.env.SAGEMAKER_AWS_SECRET_KEY;
		if (!accessKeyId || !secretAccessKey) {
			throw new AssistantError("Missing SageMaker AWS credentials", ErrorType.CONFIGURATION_ERROR);
		}

		return new AwsClient({
			accessKeyId,
			secretAccessKey,
			sessionToken: params.env.SAGEMAKER_AWS_SESSION_TOKEN,
			region,
			service: "sagemaker",
		});
	}
}

function createSageMakerInvocationBody(
	params: ChatCompletionParameters,
	deployment: TrainingDeploymentRuntimeRecord,
	providerName: string,
): Record<string, unknown> {
	const model = getTrainingModel(deployment.modelId);
	if (model?.inferenceRuntime === "sagemaker-openai") {
		return createOpenAiCompatibleInvocationBody(params, providerName, model.baseModel);
	}

	return {
		inputs: formatTextGenerationPrompt(
			providerName,
			params.messages ?? [],
			params.system_prompt,
			params.model,
		),
		parameters: createTextGenerationParameters(params),
	};
}

function createOpenAiCompatibleInvocationBody(
	params: ChatCompletionParameters,
	providerName: string,
	modelName: string,
): Record<string, unknown> {
	return omitNullishValues({
		model: modelName,
		messages: formatMessages(
			providerName,
			params.messages ?? [],
			params.system_prompt,
			params.model,
		).map((message) => ({
			role: message.role === "developer" ? "system" : message.role,
			content: stringifyMessageContent(message.content),
		})),
		max_tokens: typeof params.max_tokens === "number" ? params.max_tokens : undefined,
		temperature: typeof params.temperature === "number" ? params.temperature : undefined,
		top_p: typeof params.top_p === "number" && !params.should_think ? params.top_p : undefined,
		stop: params.stop,
		stream: false,
	});
}

function getSageMakerRuntimeErrorMessage(data: unknown, fallback: string): string {
	if (!isRecord(data)) return fallback || "SageMaker runtime request failed";

	const message = data.message || data.Message || data.error;
	return typeof message === "string" && message ? message : fallback;
}

function extractSageMakerGeneratedText(data: unknown): string {
	if (Array.isArray(data)) {
		return data.map(extractSageMakerGeneratedText).join("");
	}

	if (!data || typeof data !== "object") {
		return typeof data === "string" ? data : "";
	}

	const response = data as SageMakerTextGenerationResponse;
	const choice = response.choices?.[0];
	if (typeof choice?.message?.content === "string") return choice.message.content;
	if (typeof choice?.delta?.content === "string") return choice.delta.content;
	if (typeof choice?.text === "string") return choice.text;
	if (typeof response.generated_text === "string") return response.generated_text;
	if (typeof response.text === "string") return response.text;

	return "";
}
