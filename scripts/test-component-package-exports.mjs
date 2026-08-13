import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const packageRoot = process.cwd();
const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));

function resolvePublishedPath(relativePath) {
	assert.match(relativePath, /^\.\/dist\//, `${relativePath} is outside the published dist folder`);
	return path.join(packageRoot, relativePath);
}

test(`${manifest.name} exposes complete package artefacts`, async () => {
	for (const [specifier, definition] of Object.entries(manifest.exports)) {
		if (typeof definition === "string") {
			const exportPath = resolvePublishedPath(definition);
			await access(exportPath);

			if (specifier.endsWith(".css")) {
				const css = await readFile(exportPath, "utf8");
				assert.match(css, /polychat/, `${specifier} does not contain Polychat styles`);

				if (manifest.name === "@ngriffin_uk/polychat-component-ui") {
					assert.match(
						css,
						/@layer polychat-ui-utilities\{/,
						"UI utilities must use a top-level layer so host resets cannot override them",
					);
					assert.doesNotMatch(
						css,
						/@layer polychat-ui\.utilities\{/,
						"Nested UI utility layers are overridden by later host reset layers",
					);
					assert.match(css, /\.bg-red-800\{background-color:var\(--color-red-800\)\}/);
				}
			}
			continue;
		}

		assert.equal(typeof definition.import, "string", `${specifier} has no ESM import`);
		assert.equal(typeof definition.types, "string", `${specifier} has no type declaration`);

		const importPath = resolvePublishedPath(definition.import);
		await access(importPath);
		await access(resolvePublishedPath(definition.types));

		const runtimeExports = await import(pathToFileURL(importPath).href);
		assert.ok(Object.keys(runtimeExports).length > 0, `${specifier} has no runtime exports`);
	}
});
