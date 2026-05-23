import { conversationModeMetadataSchema, type ConversationModeMetadata } from "@assistant/schemas";
import type { ChatRequestOptions } from "~/types";

export function buildConversationModeMetadataFromRequestOptions(
	options: ChatRequestOptions | undefined,
): ConversationModeMetadata | undefined {
	const mode = options?.sandbox?.enabled ? "sandbox" : options?.council?.enabled ? "council" : null;
	if (!mode) {
		return undefined;
	}

	const parsed = conversationModeMetadataSchema.safeParse({
		mode,
		requestOptions: options,
		sandboxSettings: options?.sandbox?.enabled
			? {
					repoKey:
						typeof options.sandbox.installationId === "number" && options.sandbox.repo
							? `${options.sandbox.installationId}:${options.sandbox.repo}`
							: undefined,
					taskType: options.sandbox.taskType,
					promptStrategy: options.sandbox.promptStrategy,
					timeoutSecondsInput:
						typeof options.sandbox.timeoutSeconds === "number"
							? String(options.sandbox.timeoutSeconds)
							: undefined,
					shouldCommit: options.sandbox.shouldCommit,
				}
			: undefined,
	});

	return parsed.success ? parsed.data : undefined;
}
