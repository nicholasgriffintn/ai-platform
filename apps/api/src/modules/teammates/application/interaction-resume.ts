import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  responseCommandSchema,
  teammateRunConfigurationSchema,
  type ResponseCommand,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { readToolInteractionId } from "~/modules/responses/application/runs/interactions";
import type { AnonymousUser, IEnv, IUser } from "~/types";

import { resumeTeammateRun } from "./run-admission";

export async function resumeStoredTeammateInteraction(params: {
  env: IEnv;
  context: ServiceContext;
  body: ResponseCommand;
  user: IUser | undefined;
  anonymousUser: AnonymousUser | undefined;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}) {
  const body = responseCommandSchema.parse(params.body);
  const interactionId = readToolInteractionId(body.options);

  if (!interactionId) {
    return null;
  }

  params.context.ensureDatabase();
  const run = await params.context.repositories
    .get(ConversationRunRepository)
    .getForInteraction(body.completion_id, interactionId);
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
