import { compactionStatusLabels } from "@assistant/schemas/compaction-status";
import { isRecord } from "~/lib/objects";

export function getChatStreamLoadingMessage(state: string, data?: unknown): string | null {
	switch (state) {
		case "init":
			return "Calling provider...";
		case "thinking":
			return "Thinking about response...";
		case "compaction":
			return compactionStatusLabels.automaticPending;
		case "post_processing":
			return "Finalizing response...";
		case "tool_use_start": {
			const toolName =
				isRecord(data) && typeof data.tool_name === "string" ? data.tool_name.trim() : "";
			return toolName ? `Running tool ${toolName}...` : "Running tool...";
		}
		case "tool_use_stop":
			return "Tool execution completed.";
		default:
			return null;
	}
}
