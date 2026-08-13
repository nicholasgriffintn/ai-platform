import assert from "node:assert/strict";
import { access } from "node:fs/promises";

const packageRoot = new URL("../", import.meta.url);
const manifest = (
	await import(new URL("package.json", packageRoot), {
		with: { type: "json" },
	})
).default;

for (const relativePath of Object.values(manifest.exports["."])) {
	await access(new URL(relativePath, packageRoot));
}

const publicInterface = await import(new URL(manifest.exports["."].import, packageRoot));
assert.equal(typeof publicInterface.executeAgentLoop, "function");
assert.equal(typeof publicInterface.parseAgentDecision, "function");
