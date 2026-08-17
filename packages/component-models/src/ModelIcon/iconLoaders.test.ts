import { describe, expect, it } from "vitest";

import { MODEL_ICONS, PROVIDER_ICONS } from "./iconDefinitions";
import { ICON_LOADERS } from "./iconLoaders";

describe("icon registry", () => {
	it("can load every icon the model and provider tables point at", () => {
		const referenced = new Set([...Object.values(MODEL_ICONS), ...Object.values(PROVIDER_ICONS)]);
		const missing = [...referenced].filter((iconName) => !ICON_LOADERS[iconName]);

		expect(missing).toEqual([]);
	});

	it("resolves a registered icon to a renderable module", async () => {
		const module = await ICON_LOADERS.anthropic();

		expect(module.default).toBeTypeOf("object");
	});
});
