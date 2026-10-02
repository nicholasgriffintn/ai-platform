import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import type z from "zod/v4";

export async function readValidatedProviderResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  maxBytes: number,
  provider: string,
): Promise<T> {
  const parsed = schema.safeParse(
    safeParseJson(await readResponseTextWithinLimit(response, maxBytes)),
  );

  if (!parsed.success) {
    throw new AssistantError(
      `${provider} returned an unsupported response`,
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  return parsed.data;
}
