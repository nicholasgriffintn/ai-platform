import { PolychatApiError } from "./polychat-client";
import { SandboxCancellationError } from "./cancellation";

export type SandboxErrorType =
	| "cancelled"
	| "validation_error"
	| "repository_error"
	| "model_request_error"
	| "model_response_error"
	| "command_policy_error"
	| "command_execution_error"
	| "agent_loop_error"
	| "unknown_error";

export interface ClassifiedSandboxError {
	type: SandboxErrorType;
	message: string;
	retryable: boolean;
}

function messageIncludes(message: string, terms: string[]): boolean {
	const lowerMessage = message.toLowerCase();
	return terms.some((term) => lowerMessage.includes(term.toLowerCase()));
}

export function classifySandboxError(error: unknown): ClassifiedSandboxError {
	if (error instanceof SandboxCancellationError) {
		return {
			type: "cancelled",
			message: error.message || "Sandbox run cancelled",
			retryable: false,
		};
	}

	if (error instanceof PolychatApiError) {
		const message = error.retryable
			? "The AI model is temporarily unavailable. Please retry this run."
			: "The AI model request failed. Check the configured model and request details.";
		return {
			type: "model_request_error",
			message,
			retryable: error.retryable,
		};
	}

	if (error instanceof Error) {
		const message = error.message || "Sandbox execution failed";

		if (
			messageIncludes(message, [
				"Task is required",
				"Repository is required",
				"GitHub repo in the format",
				"Invalid task payload",
			])
		) {
			return {
				type: "validation_error",
				message,
				retryable: false,
			};
		}

		if (
			messageIncludes(message, [
				"git clone",
				"Failed to generate git diff",
				"Repository context",
			])
		) {
			return {
				type: "repository_error",
				message,
				retryable: false,
			};
		}

		if (
			messageIncludes(message, [
				"Invalid agent decision",
				"Agent exceeded",
				"No executable commands were returned",
			])
		) {
			return {
				type: "model_response_error",
				message,
				retryable: false,
			};
		}

		if (
			messageIncludes(message, [
				"blocked shell operators",
				"blocked by sandbox policy",
				"Command contains blocked shell evaluation",
			])
		) {
			return {
				type: "command_policy_error",
				message,
				retryable: false,
			};
		}

		if (messageIncludes(message, ["Command failed"])) {
			return {
				type: "command_execution_error",
				message,
				retryable: false,
			};
		}

		if (messageIncludes(message, ["agent"])) {
			return {
				type: "agent_loop_error",
				message,
				retryable: false,
			};
		}

		return {
			type: "unknown_error",
			message,
			retryable: false,
		};
	}

	return {
		type: "unknown_error",
		message: "Unknown sandbox execution error",
		retryable: false,
	};
}
