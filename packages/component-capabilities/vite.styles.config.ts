import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		emptyOutDir: false,
		lib: {
			entry: "src/styles.entry.ts",
			formats: ["es"],
			fileName: "styles",
			cssFileName: "index",
		},
	},
});
