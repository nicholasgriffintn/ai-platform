import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/audio.ts",
		"src/audio-commit-gate.ts",
		"src/audio-levels.ts",
		"src/errors.ts",
		"src/messages.ts",
		"src/websocket-protocols.ts",
	],
	format: ["cjs", "esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
});
