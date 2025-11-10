import type { ChatCompletionParameters } from "~/types";
import {
	getAiGatewayMetadataHeaders,
	resolveAiGatewayCacheTtl,
} from "~/utils/aiGateway";
import { BaseProvider } from "./base";

export class ParallelProvider extends BaseProvider {
	name = "parallel";
	supportsStreaming = true;
	isOpenAiCompatible = true;

	protected getProviderKeyName(): string {
		return "PARALLEL_API_KEY";
	}

	protected validateParams(params: ChatCompletionParameters): void {
		super.validateParams(params);
		this.validateAiGatewayToken(params);
	}

	protected async getEndpoint(): Promise<string> {
		return "chat/completions";
	}

	protected async getHeaders(
		params: ChatCompletionParameters,
	): Promise<Record<string, string>> {
		const apiKey = await this.getApiKey(params, params.user?.id);
		return {
			"cf-aig-authorization": params.env.AI_GATEWAY_TOKEN || "",
			"x-api-key": apiKey,
			"Content-Type": "application/json",
			"cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
			"cf-aig-cache-ttl": resolveAiGatewayCacheTtl(params).toString(),
		};
	}
}
