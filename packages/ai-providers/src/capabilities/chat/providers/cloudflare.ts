import { CLOUDFLARE_AUTO_ROUTER_MODELS } from "@ngriffin_uk/polychat-ai-models";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseBearerToken } from "@ngriffin_uk/polychat-utility-server/http";

import { getAiGatewayMetadataHeaders, resolveAiGatewayId } from "../../../gateway.js";
import { isProviderPlatformEnabled } from "../../../platform-credentials.js";
import type { ChatCompletionParameters } from "../../../types/index.js";
import { BaseProvider } from "./base.js";

export class CloudflareAutoRouterProvider extends BaseProvider {
  name = "cloudflare";
  supportsStreaming = true;
  isOpenAiCompatible = false;

  protected getProviderKeyName(): string {
    return "AI_GATEWAY_TOKEN";
  }

  protected validateParams(params: ChatCompletionParameters): void {
    super.validateParams(params);

    if (params.model !== "cloudflare/auto") {
      throw new AssistantError("Unsupported Cloudflare Auto Router model", ErrorType.PARAMS_ERROR);
    }

    if (params.credentialAuthority === "byok") {
      throw new AssistantError(
        "Cloudflare Auto Router requires platform gateway credentials",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    if (!isProviderPlatformEnabled(this.name, params.env)) {
      throw new AssistantError(
        "Enable CLOUDFLARE_AUTO_ROUTER_ENABLED and configure ACCOUNT_ID and AI_GATEWAY_TOKEN",
        ErrorType.CONFIGURATION_ERROR,
      );
    }
  }

  protected async getEndpoint(params: ChatCompletionParameters): Promise<string> {
    const accountId = params.env.ACCOUNT_ID;

    if (!accountId) {
      throw new AssistantError("Missing ACCOUNT_ID", ErrorType.CONFIGURATION_ERROR);
    }

    return `https://gateway.ai.cloudflare.com/v1/${encodeURIComponent(accountId)}/${resolveAiGatewayId()}/compat/chat/completions`;
  }

  protected async getHeaders(params: ChatCompletionParameters): Promise<Record<string, string>> {
    const configuredToken = params.env.AI_GATEWAY_TOKEN?.trim();

    if (!configuredToken) {
      throw new AssistantError("Missing AI_GATEWAY_TOKEN", ErrorType.CONFIGURATION_ERROR);
    }

    const token = parseBearerToken(configuredToken) ?? configuredToken;
    const userId = params.context?.user?.id ?? params.context?.anonymousUser?.id;

    return {
      "cf-aig-authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "cf-aig-metadata": JSON.stringify(getAiGatewayMetadataHeaders(params)),
      "cf-aig-skip-cache": "true",
      "cf-aig-max-attempts": "1",
      "cf-aig-allowed-models": CLOUDFLARE_AUTO_ROUTER_MODELS.map(
        ({ gatewayModel }) => gatewayModel,
      ).join(","),
      ...(params.completion_id
        ? { "cf-aig-session-id": `${userId ?? "system"}:${params.completion_id}` }
        : {}),
    };
  }
}
