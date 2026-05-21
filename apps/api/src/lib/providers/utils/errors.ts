import { AssistantError, ErrorType } from "~/utils/errors";

const MAX_PROVIDER_ERROR_PREVIEW_LENGTH = 1000;

export async function createProviderResponseError(
	response: Response,
	message: string,
): Promise<AssistantError> {
	const responseBody = await response.text().catch(() => "[unable to read response body]");
	const responsePreview =
		responseBody.length > MAX_PROVIDER_ERROR_PREVIEW_LENGTH
			? `${responseBody.slice(0, MAX_PROVIDER_ERROR_PREVIEW_LENGTH)}...`
			: responseBody;

	return new AssistantError(
		`${message}: ${response.status} ${response.statusText}`,
		ErrorType.EXTERNAL_API_ERROR,
		500,
		{
			providerStatus: response.status,
			providerStatusText: response.statusText,
			providerResponse: responsePreview,
		},
	);
}
