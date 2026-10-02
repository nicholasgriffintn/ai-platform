import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { readResponseTextWithinLimit } from "@ngriffin_uk/polychat-utility-server/http";

export async function throwExternalApiResponseError(
  response: Response,
  operation: string,
): Promise<never> {
  const detail = await readResponseTextWithinLimit(response, 64 * 1024);

  throw new AssistantError(
    `${operation} failed (${response.status}): ${detail.slice(0, 1000)}`,
    ErrorType.EXTERNAL_API_ERROR,
    502,
  );
}
