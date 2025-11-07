import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { strudelGenerateResponseSchema } from "@assistant/schemas";
import type { z } from "zod";
import type { ChatRole, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { AIProviderFactory } from "~/lib/providers/factory";
import { buildStrudelSystemPrompt } from "~/lib/prompts/strudel";
import {
	getAuxiliaryModel,
	getModels,
	filterModelsForUserAccess,
} from "~/lib/models";

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

		const provider = AIProviderFactory.getProvider(providerName);

		const messages: { role: ChatRole; content: string }[] = [
			{
				role: "system",
				content: systemPrompt,
			},
			{
				role: "user",
				content: userPrompt,
			},
		];

		const aiResponse: any = await provider.getResponse(
			{
				model,
				env: runtimeEnv,
				user,
				messages,
				temperature: 0.7,
				max_tokens: 8192,
				stream: false,
				store: false,
			},
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
