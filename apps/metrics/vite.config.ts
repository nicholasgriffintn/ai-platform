import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		tailwindcss(),
		visualizer({
			open: false,
			brotliSize: true,
		}),
	],
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom"],
					"vendor-ui": ["lucide-react"],
					"vendor-utils": [
						"@tanstack/react-query",
						"@tanstack/react-query-devtools",
					],
				},
			},
		},
		chunkSizeWarningLimit: 1000,
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
			},
		},
		reportCompressedSize: true,
		sourcemap: false,
	},
});
