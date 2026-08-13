import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const packageRoot = new URL("../", import.meta.url);

test("every public preset resolves to a published file", async () => {
	const manifest = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));

	for (const relativePath of Object.values(manifest.exports)) {
		await access(new URL(relativePath, packageRoot));
		assert.equal(
			manifest.files.some((directory) => relativePath.startsWith(`./${directory}/`)),
			true,
			`${relativePath} is omitted from published files`,
		);
	}
});

test("runtime presets expose plain configuration objects", async () => {
	const tailwind = (await import("../tailwind/react-dom.cjs")).default;
	const { nodeTestConfig } = await import("../vitest/node.js");
	const { reactTestConfig } = await import("../vitest/react.js");

	assert.equal(tailwind.darkMode, "class");
	assert.equal(nodeTestConfig.environment, "node");
	assert.equal(reactTestConfig.environment, "jsdom");
});
