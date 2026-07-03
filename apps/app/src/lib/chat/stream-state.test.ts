import { describe, expect, it } from "vitest";

import { getChatStreamLoadingMessage } from "./stream-state";

describe("getChatStreamLoadingMessage", () => {
	it("maps chat stream states to user-visible loading messages", () => {
		expect(getChatStreamLoadingMessage("init")).toBe("Calling provider...");
		expect(getChatStreamLoadingMessage("thinking")).toBe("Thinking about response...");
		expect(getChatStreamLoadingMessage("compaction")).toBe("Automatically compacting context");
		expect(getChatStreamLoadingMessage("post_processing")).toBe("Finalizing response...");
		expect(getChatStreamLoadingMessage("tool_use_stop")).toBe("Tool execution completed.");
	});

	it("formats tool start loading messages with and without a tool name", () => {
		expect(getChatStreamLoadingMessage("tool_use_start", { tool_name: "web_search" })).toBe(
			"Running tool web_search...",
		);
		expect(getChatStreamLoadingMessage("tool_use_start", { tool_name: " " })).toBe(
			"Running tool...",
		);
	});

	it("ignores unknown stream states", () => {
		expect(getChatStreamLoadingMessage("usage_limits")).toBeNull();
		expect(getChatStreamLoadingMessage("done")).toBeNull();
	});
});
