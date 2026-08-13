import { defineConfig } from "tsup";
export default defineConfig({
	entry: {
		content: "src/content/index.tsx",
		media: "src/media/index.tsx",
		music: "src/music/index.tsx",
		training: "src/training/index.tsx",
	},
	format: ["esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	external: ["react", "react-dom"],
});
