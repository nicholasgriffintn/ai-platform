import { priceModelTurnUsage } from "@ngriffin_uk/polychat-ai-billing";
import type { CompletionResult } from "@ngriffin_uk/polychat-ai-functions";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import type { Message, ProviderEnv } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger, normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { getSystemModelLineup, type ModelLineupCandidate } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import { findModelConfig } from "~/modules/models/application/resolve";

const MICROS_PER_USD = 1_000_000;
const STORY_MODEL_ROLE = "housekeeping";
const logger = getLogger({ prefix: "stories/model" });

export interface StoryModelRequest<TObject> {
  schema: z.ZodType<TObject>;
  system: string;
  material: string;
}

export interface StoryModelResult<TObject> {
  object: TObject;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  repaired: boolean;
}

async function priceCompletions(
  completions: readonly CompletionResult[],
): Promise<Pick<StoryModelResult<unknown>, "inputTokens" | "outputTokens" | "costMicros">> {
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;

  for (const completion of completions) {
    const usage = normaliseTokenUsage(completion.usage);
    const config = await findModelConfig(completion.model, undefined, completion.provider);
    const usd = config ? priceModelTurnUsage(config, { usage, rawUsage: completion.usage }) : null;

    inputTokens += usage?.input_tokens ?? 0;
    outputTokens += usage?.output_tokens ?? 0;
    costMicros += usd === null ? 0 : Math.round(usd * MICROS_PER_USD);
  }

  return { inputTokens, outputTokens, costMicros };
}

async function draftWithStoryModel<TObject>(
  env: ProviderEnv,
  request: StoryModelRequest<TObject>,
  candidate: ModelLineupCandidate,
  recordCompletion: (completion: CompletionResult) => void,
) {
  let previous: CompletionResult | undefined;
  const generate = (messages: Message[]) =>
    ai.generateObject(
      {
        env,
        model: candidate.model,
        provider: candidate.provider,
        name: "story_version",
        schema: request.schema,
        system: request.system,
        messages,
        store: false,
        disable_functions: true,
        ...(candidate.effort ? { reasoning_effort: candidate.effort } : {}),
      },
      async (completion) => {
        previous = completion;
        recordCompletion(completion);
      },
    );
  const opening: Message[] = [{ role: "user", content: request.material }];

  try {
    return { result: await generate(opening), repaired: false };
  } catch (error) {
    if (!previous) {
      throw error;
    }

    const result = await generate([
      ...opening,
      { role: "assistant", content: previous.text },
      {
        role: "user",
        content: renderPrompt("stories/version-repair", { issues: getErrorMessage(error) }),
      },
    ]);

    return { result, repaired: true };
  }
}

export async function generateStoryVersion<TObject>(
  env: ProviderEnv,
  request: StoryModelRequest<TObject>,
): Promise<StoryModelResult<TObject>> {
  const candidates = getSystemModelLineup(STORY_MODEL_ROLE).defaults;
  const completions: CompletionResult[] = [];
  let lastError: unknown = new AssistantError(
    "No platform model is set for stories",
    ErrorType.CONFIGURATION_ERROR,
  );

  for (const [index, candidate] of candidates.entries()) {
    const draft = await draftWithStoryModel(env, request, candidate, (completion) => {
      completions.push(completion);
    }).catch((error: unknown) => {
      lastError = error;

      if (index < candidates.length - 1) {
        logger.warn("Story model failed, trying the next model", { model: candidate.model, error });
      }

      return null;
    });

    if (draft) {
      return {
        object: draft.result.object,
        model: draft.result.model,
        repaired: draft.repaired,
        ...(await priceCompletions(completions)),
      };
    }
  }

  throw lastError;
}
