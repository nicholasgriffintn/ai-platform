import { priceModelTurnUsage } from "@ngriffin_uk/polychat-ai-billing";
import type { CompletionResult } from "@ngriffin_uk/polychat-ai-functions";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import type { Message } from "@ngriffin_uk/polychat-ai-providers";
import { normaliseTokenUsage } from "@ngriffin_uk/polychat-ai-telemetry";
import { getSystemModelLineup } from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import type z from "zod/v4";

import { ai } from "~/infrastructure/ai";
import { findModelConfig } from "~/modules/models/application/resolve";
import type { IEnv } from "~/types";

const MICROS_PER_USD = 1_000_000;
const STORY_MODEL_ROLE = "housekeeping";

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
  env: IEnv,
  completions: readonly CompletionResult[],
): Promise<Pick<StoryModelResult<unknown>, "inputTokens" | "outputTokens" | "costMicros">> {
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;

  for (const completion of completions) {
    const usage = normaliseTokenUsage(completion.usage);
    const config = await findModelConfig(completion.model, env, completion.provider);
    const usd = config ? priceModelTurnUsage(config, { usage, rawUsage: completion.usage }) : null;

    inputTokens += usage?.input_tokens ?? 0;
    outputTokens += usage?.output_tokens ?? 0;
    costMicros += usd === null ? 0 : Math.round(usd * MICROS_PER_USD);
  }

  return { inputTokens, outputTokens, costMicros };
}

function platformStoryModel() {
  const [candidate] = getSystemModelLineup(STORY_MODEL_ROLE).defaults;

  if (!candidate) {
    throw new AssistantError("No platform model is set for stories", ErrorType.CONFIGURATION_ERROR);
  }

  return candidate;
}

export async function generateStoryVersion<TObject>(
  env: IEnv,
  request: StoryModelRequest<TObject>,
): Promise<StoryModelResult<TObject>> {
  const resolved = platformStoryModel();
  const completions: CompletionResult[] = [];
  const generate = (messages: Message[]) =>
    ai.generateObject(
      {
        env,
        model: resolved.model,
        provider: resolved.provider,
        name: "story_version",
        schema: request.schema,
        system: request.system,
        messages,
        store: false,
        disable_functions: true,
        ...(resolved.effort ? { reasoning_effort: resolved.effort } : {}),
      },
      async (completion) => {
        completions.push(completion);
      },
    );
  const opening: Message[] = [{ role: "user", content: request.material }];
  let repaired = false;
  let object: TObject;

  try {
    ({ object } = await generate(opening));
  } catch (error) {
    const previous = completions.at(-1);

    if (!previous) {
      throw error;
    }

    repaired = true;
    ({ object } = await generate([
      ...opening,
      { role: "assistant", content: previous.text },
      {
        role: "user",
        content: renderPrompt("stories/version-repair", { issues: getErrorMessage(error) }),
      },
    ]));
  }

  return {
    object,
    model: completions.at(-1)?.model ?? resolved.model,
    repaired,
    ...(await priceCompletions(env, completions)),
  };
}
