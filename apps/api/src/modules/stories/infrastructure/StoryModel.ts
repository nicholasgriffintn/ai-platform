import { resolveAiGatewayId } from "@ngriffin_uk/polychat-ai-providers";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  omitJsonSchemaPatterns,
  parseAIResponseJson,
} from "@ngriffin_uk/polychat-utility-server/json";
import z from "zod/v4";

import type { IEnv } from "~/types";

export const STORY_VERSION_MODEL = "@cf/zai-org/glm-5.3";
const STORY_VERSION_MAX_TOKENS = 4000;

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
}

const workersUsageSchema = z
  .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
  .optional();

function readOutput(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return null;
  }

  const choice = Array.isArray(raw.choices) ? raw.choices[0] : undefined;
  const content =
    raw.response ?? (isRecord(choice) && isRecord(choice.message) ? choice.message.content : null);

  return typeof content === "string" ? parseAIResponseJson<unknown>(content).data : content;
}

export async function generateStoryObject<TObject>(
  env: IEnv,
  request: StoryModelRequest<TObject>,
): Promise<StoryModelResult<TObject>> {
  const raw: unknown = await env.AI.run(
    STORY_VERSION_MODEL,
    {
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.material },
      ],
      response_format: {
        type: "json_schema",
        json_schema: omitJsonSchemaPatterns(z.toJSONSchema(request.schema)),
      },
      max_tokens: STORY_VERSION_MAX_TOKENS,
    },
    { gateway: { id: resolveAiGatewayId(), skipCache: true } },
  );
  const parsed = request.schema.safeParse(readOutput(raw));

  if (!parsed.success) {
    throw new AssistantError(
      "The story model returned an unusable version",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const usage = workersUsageSchema.safeParse(isRecord(raw) ? raw.usage : undefined);

  return {
    object: parsed.data,
    model: STORY_VERSION_MODEL,
    inputTokens: usage.success ? (usage.data?.prompt_tokens ?? 0) : 0,
    outputTokens: usage.success ? (usage.data?.completion_tokens ?? 0) : 0,
  };
}
