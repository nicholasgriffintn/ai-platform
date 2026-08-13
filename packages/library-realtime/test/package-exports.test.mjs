import assert from "node:assert/strict";
import { test } from "node:test";
import { access } from "node:fs/promises";

import manifest from "../package.json" with { type: "json" };

test("every public export exists in dist", async () => {
	for (const target of Object.values(manifest.exports)) {
		for (const path of Object.values(target)) await access(new URL(`../${path}`, import.meta.url));
	}
	const entry = await import(new URL(`../${manifest.exports["."].import}`, import.meta.url));
	assert.equal(typeof entry.connectRealtimeWebSocket, "function");
});
