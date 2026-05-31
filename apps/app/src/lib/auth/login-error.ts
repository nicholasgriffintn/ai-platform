type LoginErrorMethod = "apple" | "github" | "passkey" | "email";

const APPLE_CANCELLED_ERRORS = new Set(["popup_closed_by_user", "user_cancelled_authorize"]);

export function getLoginErrorMessage(message: string, method?: LoginErrorMethod): string {
	const trimmedMessage = message.trim();

	if (method === "apple" && APPLE_CANCELLED_ERRORS.has(trimmedMessage)) {
		return "Apple sign-in was cancelled. Try again or choose another method.";
	}

	if (!trimmedMessage) {
		return "Sign in failed. Try again or choose another method.";
	}

	return trimmedMessage;
}
