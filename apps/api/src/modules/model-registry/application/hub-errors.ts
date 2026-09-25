import {
  isModelSourceError,
  type ModelSourceErrorCode,
} from "@ngriffin_uk/polychat-ai-model-sources";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const SOURCE_ERROR_MAPPING: Record<ModelSourceErrorCode, [ErrorType, number]> = {
  invalid_reference: [ErrorType.PARAMS_ERROR, 400],
  not_found: [ErrorType.NOT_FOUND, 404],
  unauthorised: [ErrorType.FORBIDDEN, 403],
  rate_limited: [ErrorType.RATE_LIMIT_ERROR, 429],
  upstream_error: [ErrorType.PROVIDER_ERROR, 502],
};

export async function withHubErrors<T>(
  work: () => Promise<T>,
  messages: Partial<Record<ModelSourceErrorCode, string>> = {},
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!isModelSourceError(error)) {
      throw error;
    }

    const [type, status] = SOURCE_ERROR_MAPPING[error.code];

    throw new AssistantError(messages[error.code] ?? error.message, type, status);
  }
}
