import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";

export async function requireSuccessfulChannelSend(
  response: Response,
  channel: string,
): Promise<void> {
  const body = await response.text();
  const parsed = safeParseJson<unknown>(body);
  const rejected = isRecord(parsed) && parsed.ok === false;

  if (!response.ok || rejected) {
    throw new AssistantError(`${channel} rejected the reply`, ErrorType.PROVIDER_ERROR, 502, {
      status: response.status,
    });
  }
}
