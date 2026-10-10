import { extractTextFromMessageContent, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import { DEFAULT_MODEL_TIER } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatCompletionParameters } from "~/types";

import { AgentHostClient } from "./AgentHostClient";
import { runHostedHermesTurn } from "./hostedHermesTurn";

export class HostedHermesChatProvider implements AIProvider {
  readonly name = "hermes";
  readonly supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters) {
    const context = params.context;
    const user = context?.user;

    if (!context || !user?.id) {
      throw new AssistantError("Sign in to use Hermes", ErrorType.AUTHENTICATION_ERROR, 401);
    }

    if (!hasProEntitlement(user)) {
      throw new AssistantError(
        "Hosted Hermes is available on paid plans",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    if (!params.env.COMPUTER_WORKER) {
      throw new AssistantError(
        "Hosted agents are not configured on this server",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const input = extractTextFromMessageContent(params.messages?.at(-1)?.content);

    if (!input || !params.completion_id) {
      throw new AssistantError("Hermes needs a message in a conversation", ErrorType.PARAMS_ERROR);
    }

    const settings = await context.getUserSettings();
    const result = await runHostedHermesTurn({
      context,
      client: new AgentHostClient(params.env.COMPUTER_WORKER),
      userId: user.id,
      conversationId: params.completion_id,
      input,
      modelTier: settings?.default_model_tier ?? DEFAULT_MODEL_TIER,
    });
    const deniedNote =
      result.deniedActions.length > 0
        ? `\n\nHermes asked to ${result.deniedActions.join("; ")}. Polychat declined because hosted Hermes cannot run actions that need approval.`
        : "";

    return {
      response: `${result.output}${deniedNote}`,
      model: "hermes",
      provider: this.name,
      data: {
        hermesRunId: result.runId,
        deniedActions: result.deniedActions,
      },
    };
  }
}
