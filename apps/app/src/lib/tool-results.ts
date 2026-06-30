import type { Message } from "~/types";
import { isRecord, readOptionalString } from "./objects";
import { isWeatherData } from "./weather";

type ToolResultPart = Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>;

export interface RenderableToolResult {
	name: string;
	content: string;
	result: Record<string, unknown>;
}

export function resolveRenderableToolResult(part: ToolResultPart): RenderableToolResult | null {
	const data = isRecord(part.data) ? part.data : undefined;
	const name = part.name ?? readOptionalString(data?.name);

	if (name === "get_weather" && data && isWeatherData(data)) {
		return {
			name,
			content: resolveToolResultContent(part.content),
			result: {
				status: part.status,
				name,
				content: resolveToolResultContent(part.content),
				data,
			},
		};
	}

	return null;
}

function resolveToolResultContent(content: ToolResultPart["content"]) {
	if (typeof content === "string") {
		return content;
	}

	if (content) {
		return JSON.stringify(content, null, 2);
	}

	return "";
}
