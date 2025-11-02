import type { ChatCompletionParameters } from "~/types";
import { BaseProvider } from "./base";

export class InceptionProvider extends BaseProvider {
	name = "inception";
	supportsStreaming = true;
	isOpenAiCompatible = false;

	protected getProviderKeyName(): string {
		return "INCEPTION_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
	}

	protected async getEndpoint(
		params: ChatCompletionParameters,
	): Promise<string> {
		if (params.edit_operation === "next") {
			return "https://api.inceptionlabs.ai/v1/edit/completions";
		}

		if (params.edit_operation === "apply") {
			return "https://api.inceptionlabs.ai/v1/apply/completions";
		}

		if (params.fim_mode || typeof params.suffix !== "undefined") {
			return "https://api.inceptionlabs.ai/v1/fim/completions";
		}

		return "https://api.inceptionlabs.ai/v1/chat/completions";
	}

	async mapParameters(params: ChatCompletionParameters) {
		if (params.edit_operation) {
			const serializeContent = (content: any): string => {
				if (typeof content === "string") {
					return content;
				}

				if (Array.isArray(content)) {
					return content
						.map((part) => {
							if (typeof part === "string") {
								return part;
							}

							if (typeof part === "object" && part !== null) {
								if (typeof part.text === "string") {
									return part.text;
								}

								if (part.markdown_document?.markdown) {
									return part.markdown_document.markdown;
								}

								if (typeof part.content === "string") {
									return part.content;
								}
							}

							return "";
						})
						.filter((segment) => segment && segment.length > 0)
						.join("\n");
				}

				return "";
			};

			const messages = params.messages?.map((message) => ({
				role: message.role,
				content: serializeContent(message.content),
			}));

			const editParams = {
				model: params.model,
				messages,
				temperature: params.temperature,
				top_p: params.top_p,
				stream: params.stream,
			};

			return Object.fromEntries(
				Object.entries(editParams).filter(
					([, value]) => value !== undefined && value !== null,
				),
			);
		}

		if (params.fim_mode || typeof params.suffix !== "undefined") {
			const fimParams = {
				model: params.model,
				prompt: params.prompt,
				suffix: params.suffix,
				max_tokens: params.max_tokens,
				min_tokens: params.min_tokens,
				temperature: params.temperature,
				top_p: params.top_p,
				stop: params.stop,
				stream: params.stream,
			};

			return Object.fromEntries(
				Object.entries(fimParams).filter(
					([, value]) => value !== undefined && value !== null,
				),
			);
		}

		return await this.defaultMapParameters(params);
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);

		return {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		};
	}
}
