import { normaliseTokenUsage, type NormalisedTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { parseAIResponseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { failWhenQuiet } from "@ngriffin_uk/polychat-utility-server/streaming";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { consumeProviderStream } from "~/modules/responses/application/engine/agent/provider-stream";
import { DISCARDING_EVENT_SINK } from "~/modules/responses/application/engine/streaming/emitter";
import { getAIResponse } from "~/modules/responses/application/engine/streaming/responses";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";

import { findModelConfig } from "./resolve";

const STREAM_QUIET_MS = 60_000;

export interface ModelObjectRequest<TObject> {
  env: IEnv;
  user: IUser;
  model: string;
  provider: string;
  reasoningEffort: ChatCompletionParameters["reasoning_effort"];
  name: string;
  schema: z.ZodType<TObject>;
  system: string;
  material: string;
}

export interface ModelObject<TObject> {
  object: TObject;
  usage: NormalisedTokenUsage | null;
  rawUsage: unknown;
}

function readStreamedValue(turn: {
  content: string;
  toolCalls: { function?: { arguments?: unknown } }[];
}) {
  const toolArguments = turn.toolCalls[0]?.function?.arguments;

  if (toolArguments !== undefined) {
    return typeof toolArguments === "string"
      ? parseAIResponseJson<unknown>(toolArguments).data
      : toolArguments;
  }

  return parseAIResponseJson<unknown>(turn.content).data;
}

async function streamToolObject<TObject>(
  request: ModelObjectRequest<TObject>,
): Promise<ModelObject<TObject>> {
  const context = createServiceContext({ env: request.env, user: request.user });
  const completionId = `${request.name}_${generateId()}`;
  const providerResponse = await getAIResponse({
    model: request.model,
    provider: request.provider,
    messages: [{ role: "user", content: request.material }],
    system_prompt: request.system,
    available_functions: [
      {
        name: request.name,
        description: "Return the finished result.",
        inputSchema: request.schema,
      },
    ],
    tool_choice: "required",
    reasoning_effort: request.reasoningEffort,
    completion_id: completionId,
    stream: true,
    store: false,
    env: request.env,
    context,
  });

  if (!(providerResponse instanceof ReadableStream)) {
    throw new AssistantError(
      `${request.model} did not stream its structured result`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const quietStream = failWhenQuiet(
    providerResponse,
    STREAM_QUIET_MS,
    `${request.model} sent nothing for ${STREAM_QUIET_MS / 1000} seconds`,
  );
  const turn = await consumeProviderStream(quietStream, DISCARDING_EVENT_SINK, {
    env: request.env,
    model: request.model,
    provider: request.provider,
    completionId,
    userId: request.user.id,
    serviceContext: context,
    messageId: completionId,
  });

  if (turn.error) {
    throw turn.error instanceof Error
      ? turn.error
      : new AssistantError(getErrorMessage(turn.error), ErrorType.PROVIDER_ERROR);
  }

  const validated = request.schema.safeParse(readStreamedValue(turn));

  if (!validated.success) {
    throw new AssistantError(
      `The model response did not match the schema: ${validated.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  return { object: validated.data, usage: turn.usage, rawUsage: turn.rawUsage };
}

export async function generateModelObject<TObject>(
  request: ModelObjectRequest<TObject>,
): Promise<ModelObject<TObject>> {
  if ((await findModelConfig(request.model, request.env, request.provider))?.supportsToolCalls) {
    return streamToolObject(request);
  }

  const completion = await ai.generateObject({
    env: request.env,
    user: request.user,
    model: request.model,
    provider: request.provider,
    reasoning_effort: request.reasoningEffort,
    disable_functions: true,
    name: request.name,
    schema: request.schema,
    system: request.system,
    prompt: request.material,
  });

  return {
    object: completion.object,
    usage: normaliseTokenUsage(completion.usage),
    rawUsage: completion.usage,
  };
}
