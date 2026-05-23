import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ isSsrBuild, command }) => ({
	build: {
		rollupOptions: isSsrBuild
			? {
					input: "./workers/app.ts",
				}
			: {
					output: {
						manualChunks: manualVendorChunk,
					},
				},
		chunkSizeWarningLimit: 6500,
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
		cloudflareDevProxy({
			getLoadContext({ context }) {
				return { cloudflare: context.cloudflare };
			},
		}),
		tailwindcss(),
		reactRouter(),
		command === "build" &&
			visualizer({
				filename: "dist/stats.html",
				open: false,
				gzipSize: true,
				brotliSize: true,
			}),
	].filter(Boolean),
	resolve: {
		tsconfigPaths: true,
	},
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

const chunkGroups = [
	{
		name: "react-vendor",
		packages: ["react", "react-dom", "scheduler"],
	},
	{
		name: "router-vendor",
		packages: ["react-router", "@react-router"],
	},
	{
		name: "ui-vendor",
		packages: [
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
	},
	{
		name: "strudel-vendor",
		packages: [
			"@strudel/codemirror",
			"@strudel/core",
			"@strudel/draw",
			"@strudel/hydra",
			"@strudel/midi",
			"@strudel/mini",
			"@strudel/soundfonts",
			"@strudel/tonal",
			"@strudel/transpiler",
			"@strudel/webaudio",
		],
	},
	{
		name: "query-vendor",
		packages: ["@tanstack/react-query", "@tanstack/query-core"],
	},
	{
		name: "markdown-vendor",
		packages: ["react-markdown", "rehype-highlight", "remark-gfm"],
	},
	{
		name: "icons-vendor",
		packages: ["lucide-react"],
	},
	{
		name: "webllm-vendor",
		packages: ["@mlc-ai/web-llm"],
	},
	{
		name: "babel-vendor",
		packages: ["@babel/standalone"],
	},
];

function manualVendorChunk(id: string): string | undefined {
	const packageName = getNodeModulePackageName(id);
	if (!packageName) return undefined;

	return chunkGroups.find((group) =>
		group.packages.some((entry) => matchesPackage(packageName, entry)),
	)?.name;
}

function getNodeModulePackageName(id: string): string | undefined {
	const normalisedId = id.replaceAll("\\", "/");
	const marker = "/node_modules/";
	const nodeModulesIndex = normalisedId.lastIndexOf(marker);
	if (nodeModulesIndex === -1) return undefined;

	const parts = normalisedId.slice(nodeModulesIndex + marker.length).split("/");
	const packagePart = parts[0];
	if (!packagePart) return undefined;

	if (packagePart.startsWith("@")) {
		const scopedName = parts[1];
		return scopedName ? `${packagePart}/${scopedName}` : packagePart;
	}

	return packagePart;
}

function matchesPackage(packageName: string, entry: string): boolean {
	return packageName === entry || packageName.startsWith(`${entry}/`);
}
