import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createChatCompletionsJsonSchema,
  teammateRunConfigurationSchema,
  type ChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { readToolInteractionId } from "~/services/chat-runs/interactions";
import type { AnonymousUser, IEnv, IUser } from "~/types";

import { resumeTeammateRun } from "./run-admission";

export async function resumeStoredTeammateInteraction(params: {
  env: IEnv;
  context: ServiceContext;
  body: ChatCompletionRequestBody;
  user: IUser | undefined;
  anonymousUser: AnonymousUser | undefined;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}) {
  const body = createChatCompletionsJsonSchema.parse(params.body);
  const interactionId = readToolInteractionId(body.options);

  if (!interactionId) {
    return null;
  }

  params.context.ensureDatabase();
  const run = await params.context.repositories.conversationRuns.getForInteraction(
    body.completion_id,
    interactionId,
  );
  const configuration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);

  if (!configuration.success) {
    return null;
  }

  return resumeTeammateRun({
    ...params,
    body,
    teammateId: configuration.data.teammateId,
  });
}
