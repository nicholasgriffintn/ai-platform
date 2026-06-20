import { AssistantError, ErrorType } from "./errors";

const EMAIL_HEADER_CONTROL_CHARACTER_PATTERN = /[\r\n\0]/;

export function assertSafeEmailHeaderValue(fieldName: string, value: string): string {
	if (EMAIL_HEADER_CONTROL_CHARACTER_PATTERN.test(value)) {
		throw new AssistantError(
			`${fieldName} must not contain email header control characters`,
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	return value;
}
