import { compactionStatusLabels } from "@ngriffin_uk/polychat-schemas/compaction-status";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const INIT_MESSAGES = [
	"Calling provider...",
	"Getting a line to the model...",
	"Clearing a perch for the response...",
];

const THINKING_MESSAGES = [
	"Thinking it through...",
	"Turning it over...",
	"Considering the angles...",
	"Pacing the perch...",
];

const POST_PROCESSING_MESSAGES = [
	"Finalizing response...",
	"Preening the last few words...",
	"Tidying up the response...",
];

const TOOL_START_TEMPLATES = [
	(toolName: string) => `Running tool ${toolName}...`,
	(toolName: string) => `Putting ${toolName} to work...`,
];

const STREAM_SEED_CYCLE = 24;

let streamSeed = 0;

function pick<T>(options: T[]): T {
	return options[streamSeed % options.length];
}

export function getChatStreamLoadingMessage(state: string, data?: unknown): string | null {
	switch (state) {
		case "init":
			streamSeed = (streamSeed + 1) % STREAM_SEED_CYCLE;
			return pick(INIT_MESSAGES);
		case "thinking":
			return pick(THINKING_MESSAGES);
		case "compaction":
			return compactionStatusLabels.automaticPending;
		case "post_processing":
			return pick(POST_PROCESSING_MESSAGES);
		case "tool_use_start": {
			const toolName =
				isRecord(data) && typeof data.tool_name === "string" ? data.tool_name.trim() : "";
			return toolName ? pick(TOOL_START_TEMPLATES)(toolName) : "Running tool...";
		}
		case "tool_use_stop":
			return "Tool finished. Carrying on...";
		default:
			return null;
	}
}
