import { execFileSync } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const packagesRoot = path.join(process.cwd(), "packages");
const entries = await readdir(packagesRoot, { withFileTypes: true });

for (const entry of entries) {
	if (!entry.isDirectory()) continue;
	const packageRoot = path.join(packagesRoot, entry.name);
	const manifestPath = path.join(packageRoot, "package.json");
	const manifest = await readFile(manifestPath, "utf8")
		.then(JSON.parse)
		.catch(() => undefined);
	if (!manifest || manifest.private === true) continue;

	process.stdout.write(`Checking ${manifest.name}\n`);
	for (const exportedTarget of Object.values(manifest.exports ?? {})) {
		const targetPaths =
			typeof exportedTarget === "string" ? [exportedTarget] : Object.values(exportedTarget);
		for (const targetPath of targetPaths) {
			await access(path.join(packageRoot, targetPath));
		}
	}
	if (manifest.name.includes("polychat-component-") && !manifest.exports?.["./styles.css"]) {
		throw new Error(`${manifest.name} must publish an explicit CSS entry`);
	}
	execFileSync("pnpm", ["pack", "--dry-run"], {
		cwd: packageRoot,
		stdio: "inherit",
	});
}
