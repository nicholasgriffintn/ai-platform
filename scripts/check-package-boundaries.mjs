import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = process.cwd();
const packagesRoot = path.join(workspaceRoot, "packages");
const publicNamePattern = /^@ngriffin_uk\/polychat-(?:component|library|utility)-[a-z0-9-]+$/;
const exceptionalPublicNames = new Set([
	"@ngriffin_uk/polychat-config",
	"@ngriffin_uk/polychat-schemas",
]);

const dependencyRanks = new Map([
	["schemas", 0],
	["utility", 0],
	["library", 1],
	["component-ui", 2],
	["component-foundation", 3],
	["component-feature", 4],
	["component-product", 5],
]);

function packageKind(packageName) {
	if (packageName === "@ngriffin_uk/polychat-schemas") return "schemas";
	if (packageName.includes("polychat-utility-")) return "utility";
	if (packageName.includes("polychat-library-")) return "library";
	if (packageName === "@ngriffin_uk/polychat-component-ui") return "component-ui";
	if (/polychat-component-(?:content|models|navigation)$/.test(packageName)) {
		return "component-foundation";
	}
	if (/polychat-component-(?:conversation|capabilities)$/.test(packageName)) {
		return "component-feature";
	}
	if (/polychat-component-(?:workspaces|account|experiences)$/.test(packageName)) {
		return "component-product";
	}
	return undefined;
}

async function collectSourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
	const nested = await Promise.all(
		entries.map((entry) => {
			const absolutePath = path.join(directory, entry.name);
			return entry.isDirectory()
				? collectSourceFiles(absolutePath)
				: /\.[cm]?[jt]sx?$/.test(entry.name)
					? [absolutePath]
					: [];
		}),
	);
	return nested.flat();
}

const errors = [];
const packageEntries = await readdir(packagesRoot, { withFileTypes: true });
const manifests = [];

for (const entry of packageEntries) {
	if (!entry.isDirectory()) continue;
	const packageRoot = path.join(packagesRoot, entry.name);
	const manifestPath = path.join(packageRoot, "package.json");
	const manifest = await readFile(manifestPath, "utf8")
		.then(JSON.parse)
		.catch(() => undefined);
	if (!manifest) continue;
	manifests.push({ manifest, manifestPath, packageRoot });
}

const workspaceNames = new Set(manifests.map(({ manifest }) => manifest.name));

for (const { manifest, manifestPath, packageRoot } of manifests) {
	const relativeManifest = path.relative(workspaceRoot, manifestPath);
	if (manifest.private !== true) {
		if (!publicNamePattern.test(manifest.name) && !exceptionalPublicNames.has(manifest.name)) {
			errors.push(`${relativeManifest}: invalid public package name ${manifest.name}`);
		}
		if (manifest.publishConfig?.access !== "public") {
			errors.push(`${relativeManifest}: public package must declare publishConfig.access`);
		}
		if (JSON.stringify(manifest.exports ?? {}).includes("/src/")) {
			errors.push(`${relativeManifest}: public exports must not expose source files`);
		}
	}

	const sourceFiles = await collectSourceFiles(path.join(packageRoot, "src"));
	if (manifest.name.includes("polychat-component-")) {
		const componentStyles = await readFile(path.join(packageRoot, "src/styles.css"), "utf8").catch(
			() => "",
		);
		if (componentStyles.includes("prefers-color-scheme")) {
			errors.push(
				`${path.relative(workspaceRoot, packageRoot)}: component themes must follow the host theme class`,
			);
		}
	}
	for (const sourceFile of sourceFiles) {
		const source = await readFile(sourceFile, "utf8");
		const relativeSource = path.relative(workspaceRoot, sourceFile);
		if (/from\s+["'](?:~\/|src\/|apps\/)|import\s*\(["'](?:~\/|src\/|apps\/)/.test(source)) {
			errors.push(`${relativeSource}: package source imports application code or aliases`);
		}
		if (/["']@ngriffin_uk\/polychat-[^"']+\/src\//.test(source)) {
			errors.push(`${relativeSource}: package source bypasses another package export map`);
		}
		if (
			manifest.name.includes("polychat-component-") &&
			/["']react-router(?:-dom)?["']/.test(source)
		) {
			errors.push(`${relativeSource}: render packages must emit navigation intents`);
		}
		if (
			(manifest.name === "@ngriffin_uk/polychat-schemas" ||
				manifest.name === "@ngriffin_uk/polychat-utility-core") &&
			/from\s+["']react/.test(source)
		) {
			errors.push(`${relativeSource}: runtime-neutral package imports a host runtime`);
		}
	}

	const ownRank = dependencyRanks.get(packageKind(manifest.name));
	const runtimeDependencies = { ...manifest.dependencies, ...manifest.peerDependencies };
	for (const dependencyName of Object.keys(runtimeDependencies)) {
		if (!workspaceNames.has(dependencyName) || dependencyName === "@ngriffin_uk/polychat-config") {
			continue;
		}
		const dependencyRank = dependencyRanks.get(packageKind(dependencyName));
		if (ownRank !== undefined && dependencyRank !== undefined && dependencyRank > ownRank) {
			errors.push(
				`${relativeManifest}: ${manifest.name} cannot depend on higher-level ${dependencyName}`,
			);
		}
	}
}

const appSourceFiles = await collectSourceFiles(path.join(workspaceRoot, "apps/app/src"));
const packageFacadeStatement =
	/export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+["']@ngriffin_uk\/polychat-[^"']+["'];?/g;

for (const sourceFile of appSourceFiles) {
	const source = await readFile(sourceFile, "utf8");
	if (!packageFacadeStatement.test(source)) continue;
	packageFacadeStatement.lastIndex = 0;
	if (source.replaceAll(packageFacadeStatement, "").trim() === "") {
		errors.push(
			`${path.relative(workspaceRoot, sourceFile)}: import package APIs directly instead of using an app-local re-export facade`,
		);
	}
	packageFacadeStatement.lastIndex = 0;
}

const appStylesPath = path.join(workspaceRoot, "apps/app/src/styles/index.css");
const appStyles = await readFile(appStylesPath, "utf8");
const lastComponentStyleImport = appStyles.lastIndexOf("@ngriffin_uk/polychat-component-");
const hostTailwindImport = appStyles.indexOf('@import "tailwindcss"');
if (lastComponentStyleImport < 0 || hostTailwindImport < lastComponentStyleImport) {
	errors.push(
		`${path.relative(workspaceRoot, appStylesPath)}: host Tailwind utilities must load after component package fallbacks`,
	);
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(`Validated ${manifests.length} package boundaries.`);
}
