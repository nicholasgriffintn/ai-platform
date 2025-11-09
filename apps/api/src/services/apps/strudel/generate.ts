import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { strudelGenerateResponseSchema } from "@assistant/schemas";
import type { z } from "zod";
import type { IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { buildStrudelSystemPrompt } from "~/lib/prompts/strudel";
import {
	getAuxiliaryModel,
	getModels,
	filterModelsForUserAccess,
} from "~/lib/providers/models";
import { formatMessages } from "~/utils/messages";
import { mergeParametersWithDefaults } from "~/utils/parameters";

const logger = getLogger({ prefix: "services/strudel/generate" });

interface StrudelGenerateRequest {
	prompt: string;
	style?: "techno" | "ambient" | "house" | "jazz" | "drums" | "experimental";
	tempo?: number;
	complexity?: "simple" | "medium" | "complex";
	model?: string;
}

type StrudelGenerateResponse = z.infer<typeof strudelGenerateResponseSchema>;

export async function generateStrudelCode({
	context,
	env,
	request,
	user,
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: StrudelGenerateRequest;
	user: IUser;
}): Promise<StrudelGenerateResponse> {
	const serviceContext = resolveServiceContext({ context, env, user });
	const runtimeEnv = serviceContext.env as IEnv;

	if (!request.prompt || request.prompt.trim().length === 0) {
		throw new AssistantError("Prompt is required", ErrorType.PARAMS_ERROR);
	}

	try {
		const systemPrompt = buildStrudelSystemPrompt(
			request.style,
			request.complexity || "medium",
		);

		let userPrompt = `Generate Strudel code for: ${request.prompt}`;
		if (request.tempo) {
			userPrompt += `\nTempo: ${request.tempo} BPM (use .fast() or .slow() to adjust)`;
		}

		logger.info("Generating Strudel code", {
			prompt: request.prompt,
			style: request.style,
			complexity: request.complexity,
			model: request.model,
		});

		let model: string;
		let providerName: string;

		if (request.model) {
			const allModels = getModels();
			const accessibleModels = await filterModelsForUserAccess(
				allModels,
				runtimeEnv,
				user?.id || null,
			);

			const selectedModelConfig = accessibleModels[request.model];
			if (!selectedModelConfig) {
				throw new AssistantError(
					"Selected model is not available",
					ErrorType.PARAMS_ERROR,
				);
			}

			model = selectedModelConfig.matchingModel;
			providerName = selectedModelConfig.provider;
		} else {
			const auxiliaryModel = await getAuxiliaryModel(runtimeEnv, user);
			model = auxiliaryModel.model;
			providerName = auxiliaryModel.provider;
		}

		const provider = getChatProvider(providerName, {
			env: runtimeEnv,
			user,
		});

		const baseMessages: Message[] = [
			{
				role: "user",
				content: userPrompt,
			},
		];

		let formattedMessages: Message[];
		try {
			formattedMessages = formatMessages(
				provider.name,
				baseMessages,
				systemPrompt,
				model,
			);
		} catch (error) {
			logger.error("Failed to format messages for provider", {
				provider: provider.name,
				error,
			});
			throw new AssistantError(
				"Unable to prepare prompts for the selected model",
				ErrorType.PARAMS_ERROR,
			);
		}

		const requestParameters = mergeParametersWithDefaults({
			model,
			env: runtimeEnv,
			user,
			system_prompt: systemPrompt,
			messages: formattedMessages,
			temperature: 0.7,
			max_tokens: 8192,
			stream: false,
			store: false,
			completion_id: `strudel-${Date.now()}`,
			enabled_tools: [],
			tools: [],
			mode: "normal",
			platform: "dynamic-apps",
		});

		const aiResponse = await provider.getResponse(
			requestParameters,
			user?.id || null,
		);

		const rawContent =
			aiResponse?.response ||
			(Array.isArray(aiResponse?.choices) &&
				aiResponse.choices[0]?.message?.content) ||
			(typeof aiResponse === "string"
				? aiResponse
				: JSON.stringify(aiResponse));

		if (!rawContent) {
			throw new AssistantError(
				"No response from AI provider",
				ErrorType.UNKNOWN_ERROR,
			);
		}

		let generatedCode = String(rawContent);

		generatedCode = generatedCode
			.replace(/^```(?:javascript|js|strudel)?\n?/gm, "")
			.replace(/\n?```$/gm, "")
			.trim();

		logger.info("Successfully generated Strudel code", {
			codeLength: generatedCode.length,
		});

		return {
			code: generatedCode,
			explanation: `Generated a ${request.style || "musical"} pattern${request.tempo ? ` at ${request.tempo} BPM` : ""}`,
		};
	} catch (error) {
		logger.error("Error generating Strudel code:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			prompt: request.prompt,
		});

		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError(
			"Failed to generate Strudel code",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
