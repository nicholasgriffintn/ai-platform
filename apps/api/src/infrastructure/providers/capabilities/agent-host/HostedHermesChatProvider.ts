import { extractTextFromMessageContent, type AIProvider } from "@ngriffin_uk/polychat-ai-providers";
import { DEFAULT_MODEL_TIER } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ChatCompletionParameters } from "~/types";

import { requireHostedHermesAccess } from "./hostedHermesAccess";
import { runHostedHermesTurn } from "./hostedHermesTurn";

export class HostedHermesChatProvider implements AIProvider {
  readonly name = "hermes";
  readonly supportsStreaming = false;

  async getResponse(params: ChatCompletionParameters) {
    const { context, user, client } = requireHostedHermesAccess(params.context);
    const input = extractTextFromMessageContent(params.messages?.at(-1)?.content);

    if (!input || !params.completion_id) {
      throw new AssistantError("Hermes needs a message in a conversation", ErrorType.PARAMS_ERROR);
    }

    const settings = await context.getUserSettings();
    const result = await runHostedHermesTurn({
      context,
      client,
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
