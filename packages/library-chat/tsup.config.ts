import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/attachments.ts",
		"src/compaction-command.ts",
		"src/conversation-storage-policy.ts",
		"src/conversations.ts",
		"src/model-selection.ts",
		"src/request-options.ts",
	],
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
});
