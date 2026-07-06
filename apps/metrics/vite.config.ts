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
				manualChunks: manualVendorChunk,
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

const chunkGroups = [
	{
		name: "vendor-react",
		packages: ["react", "react-dom", "scheduler"],
	},
	{
		name: "vendor-ui",
		packages: ["lucide-react", "recharts", "@radix-ui"],
	},
	{
		name: "vendor-utils",
		packages: ["@tanstack/react-query", "@tanstack/query-core"],
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
