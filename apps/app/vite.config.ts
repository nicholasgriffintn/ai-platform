import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ isSsrBuild, command }) => ({
	build: {
		rollupOptions: isSsrBuild
			? {
					input: "./workers/app.ts",
				}
			: {
					output: {
						manualChunks: {
							"react-vendor": ["react", "react-dom"],
							"router-vendor": ["react-router"],
							"ui-vendor": [
								"@radix-ui/react-checkbox",
								"@radix-ui/react-dialog",
								"@radix-ui/react-dropdown-menu",
								"@radix-ui/react-label",
								"@radix-ui/react-popover",
								"@radix-ui/react-select",
								"@radix-ui/react-slider",
								"@radix-ui/react-slot",
								"@radix-ui/react-switch",
								"@radix-ui/react-tabs",
								"@radix-ui/react-toggle",
								"@radix-ui/react-toggle-group",
								"virtua",
							],
							"strudel-vendor": [
								"@strudel/codemirror",
								"@strudel/core",
								"@strudel/draw",
								"@strudel/hydra",
								"@strudel/mini",
								"@strudel/soundfonts",
								"@strudel/tonal",
								"@strudel/transpiler",
								"@strudel/webaudio",
							],
							"query-vendor": ["@tanstack/react-query"],
							"markdown-vendor": [
								"react-markdown",
								"rehype-highlight",
								"remark-gfm",
							],
							"icons-vendor": ["lucide-react"],
						},
					},
				},
		sourcemap: command === "build" ? false : true,
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: command === "build",
				drop_debugger: true,
			},
		},
	},
	plugins: [
		babel({
			filter: /\.tsx?$/,
			babelConfig: {
				presets: ["@babel/preset-typescript"],
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		cloudflareDevProxy({
			getLoadContext({ context }) {
				return { cloudflare: context.cloudflare };
			},
		}),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths({
			projectDiscovery: "lazy",
			logFile: false,
		}),
		command === "build" &&
			visualizer({
				filename: "dist/stats.html",
				open: false,
				gzipSize: true,
				brotliSize: true,
			}),
	].filter(Boolean),
	optimizeDeps: {
		include: [
			"react",
			"react-dom",
			"react-router",
			"@tanstack/react-query",
			"zustand",
			"lucide-react",
		],
	},
}));
