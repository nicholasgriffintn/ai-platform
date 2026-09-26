import {
  isModelProviderError,
  type ModelProviderErrorCode,
} from "@ngriffin_uk/polychat-ai-model-providers";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

const PROVIDER_ERROR_MAPPING: Record<ModelProviderErrorCode, [ErrorType, number]> = {
  invalid_reference: [ErrorType.PARAMS_ERROR, 400],
  not_found: [ErrorType.NOT_FOUND, 404],
  unauthorised: [ErrorType.FORBIDDEN, 403],
  rate_limited: [ErrorType.RATE_LIMIT_ERROR, 429],
  unsupported: [ErrorType.PARAMS_ERROR, 400],
  misconfigured: [ErrorType.CONFLICT_ERROR, 409],
  upstream_error: [ErrorType.PROVIDER_ERROR, 502],
};

export function toAssistantError(
  error: unknown,
  messages: Partial<Record<ModelProviderErrorCode, string>> = {},
): unknown {
  if (!isModelProviderError(error)) {
    return error;
  }

  const [type, status] = PROVIDER_ERROR_MAPPING[error.code];

  return new AssistantError(messages[error.code] ?? error.message, type, status);
}

export async function withProviderErrors<T>(
  work: () => Promise<T>,
  messages: Partial<Record<ModelProviderErrorCode, string>> = {},
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAssistantError(error, messages);
  }
}
