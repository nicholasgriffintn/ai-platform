import { safeParseJson } from "~/utils/json";
import type {
	ModelConfigItem,
	InputSchemaInputFieldDescriptor,
	Message,
	ChatCompletionParameters,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

type InputSchemaFieldType =
	| "string"
	| "number"
	| "integer"
	| "boolean"
	| "file"
	| "array"
	| "object";

type InputSchemaInputBuildResult = {
	input: Record<string, any> | string;
};

function normalizeFieldTypes(
	field: InputSchemaInputFieldDescriptor,
): InputSchemaFieldType[] {
	return Array.isArray(field.type)
		? (field.type as InputSchemaFieldType[])
		: [field.type as InputSchemaFieldType];
}

function extractPromptFromMessages(messages: Message[]): string {
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (message.role !== "user" && message.role !== "developer") {
			continue;
		}

		const { content } = message;

		if (typeof content === "string") {
			if (content.trim()) {
				return content.trim();
			}
			continue;
		}

		if (Array.isArray(content)) {
			const textParts = content
				.filter(
					(part) => part?.type === "text" && typeof part.text === "string",
				)
				.map((part) => part.text!.trim())
				.filter(Boolean);

			if (textParts.length) {
				return textParts.join("\n");
			}
		} else if (content && typeof content === "object") {
			const promptLike =
				typeof (content as any).prompt === "string"
					? (content as any).prompt
					: typeof (content as any).text === "string"
						? (content as any).text
						: undefined;

			if (promptLike && promptLike.trim()) {
				return promptLike.trim();
			}
		}
	}

	return "";
}

function extractAssetFromMessage(message?: Message): string | undefined {
	if (!message) {
		return undefined;
	}

	const { content, data } = message as any;

	if (Array.isArray(content)) {
		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}

			if (part.type === "image_url" && part.image_url?.url) {
				return part.image_url.url;
			}

			if (part.type === "audio_url" && part.audio_url?.url) {
				return part.audio_url.url;
			}

			if (part.type === "video_url" && part.video_url?.url) {
				return part.video_url.url;
			}

			if (part.type === "document_url" && part.document_url?.url) {
				return part.document_url.url;
			}

			if (part.type === "input_audio" && part.input_audio?.data) {
				return part.input_audio.data;
			}
		}
	}

	if (content && typeof content === "object" && !Array.isArray(content)) {
		if (typeof (content as any).url === "string") {
			return (content as any).url;
		}

		if (typeof (content as any).file === "string") {
			return (content as any).file;
		}
	}

	const attachments = data?.attachments;
	if (Array.isArray(attachments) && attachments.length > 0) {
		const firstAttachment = attachments[0];
		if (firstAttachment?.url) {
			return firstAttachment.url;
		}

		if (firstAttachment?.markdown) {
			return firstAttachment.markdown;
		}
	}

	return undefined;
}

function coerceValue(value: unknown, types: InputSchemaFieldType[]): unknown {
	if (value === undefined || value === null) {
		return value;
	}

	if (types.includes("boolean") && typeof value === "string") {
		if (value.toLowerCase() === "true") {
			return true;
		}
		if (value.toLowerCase() === "false") {
			return false;
		}
	}

	if (
		(types.includes("number") || types.includes("integer")) &&
		typeof value === "string"
	) {
		const parsed = types.includes("integer")
			? parseInt(value, 10)
			: parseFloat(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}

	if (types.includes("array") && typeof value === "string") {
		const parsed = safeParseJson(value);
		if (Array.isArray(parsed)) {
			return parsed;
		}
		return value;
	}

	if (types.includes("object") && typeof value === "string") {
		const parsed = safeParseJson(value);
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
	}

	return value;
}

function pickFromSources(
	fieldName: string,
	sources: Array<Record<string, any> | undefined>,
): unknown {
	for (const source of sources) {
		if (!source) {
			continue;
		}

		if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
			const value = source[fieldName];
			if (value !== undefined) {
				return value;
			}
		}
	}

	return undefined;
}

function buildFieldValue(
	field: InputSchemaInputFieldDescriptor,
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): unknown {
	const lastMessage = params.messages?.[params.messages.length - 1];
	const messageContent =
		lastMessage &&
		typeof lastMessage.content === "object" &&
		!Array.isArray(lastMessage.content)
			? (lastMessage.content as Record<string, any>)
			: undefined;

	const candidateSources = [
		params.body?.input as Record<string, any> | undefined,
		params.body as Record<string, any> | undefined,
		params.options as Record<string, any> | undefined,
		params.message && typeof params.message === "object"
			? (params.message as Record<string, any>)
			: undefined,
		messageContent,
		params as unknown as Record<string, any>,
	];

	const types = normalizeFieldTypes(field);
	let value = pickFromSources(field.name, candidateSources);

	if (value === undefined) {
		if (
			types.includes("string") &&
			(field.name.toLowerCase() === "prompt" ||
				field.name.toLowerCase() === "text")
		) {
			const prompt = extractPromptFromMessages(params.messages || []);
			if (prompt) {
				value = prompt;
			}
		} else if (types.includes("file")) {
			value = pickFromSources(field.name, [messageContent]);
			if (value === undefined) {
				value = extractAssetFromMessage(lastMessage);
			}
		}
	}

	if (value === undefined && field.default !== undefined) {
		value = field.default;
	}

	if (value === undefined && field.required) {
		throw new AssistantError(
			`Missing required input "${field.name}" for model ${modelConfig.matchingModel}`,
			ErrorType.PARAMS_ERROR,
		);
	}

	if (value === undefined) {
		return undefined;
	}

	const coerced = coerceValue(value, types);

	if (field.enum && field.enum.length > 0) {
		const enumValues = new Set(field.enum);
		if (!enumValues.has(coerced as never)) {
			throw new AssistantError(
				`Invalid value "${coerced}" for field "${field.name}". Expected one of: ${field.enum.join(", ")}.`,
				ErrorType.PARAMS_ERROR,
			);
		}
	}

	return coerced;
}

export function buildInputSchemaInput(
	params: ChatCompletionParameters,
	modelConfig: ModelConfigItem,
): InputSchemaInputBuildResult {
	const schema = modelConfig.inputSchema;
	const lastMessage = params.messages?.[params.messages.length - 1];

	if (!schema?.fields?.length) {
		const fallbackContent = lastMessage?.content;
		if (fallbackContent !== undefined) {
			if (Array.isArray(fallbackContent)) {
				const prompt = extractPromptFromMessages(params.messages || []);
				return { input: prompt || "" };
			}
			return { input: fallbackContent as any };
		}

		return { input: "" };
	}

	const input: Record<string, any> = {};

	for (const field of schema.fields) {
		const value = buildFieldValue(field, params, modelConfig);
		if (value === undefined) {
			continue;
		}

		input[field.name] = value;
	}

	return {
		input,
	};
}
