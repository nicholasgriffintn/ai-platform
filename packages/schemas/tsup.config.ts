import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/analytics.ts",
		"src/chat-stream.ts",
		"src/compaction-status.ts",
		"src/conversation-replacement.ts",
		"src/council-data.ts",
		"src/message-part-utils.ts",
		"src/provider-messages.ts",
		"src/sandbox-constants.ts",
		"src/tool-ids.ts",
	],
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
});
