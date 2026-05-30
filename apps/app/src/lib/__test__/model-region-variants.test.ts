import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "~/types";
import {
	collapseRegionalModelVariants,
	getRegionalModelDisplayName,
	isRegionalModelEntrySelected,
} from "../model-region-variants";

const makeModel = (
	id: string,
	name: string,
	provider = "bedrock",
	overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem => ({
	id,
	name,
	matchingModel: id,
	provider,
	modalities: { input: ["text"], output: ["text"] },
	isFree: true,
	...overrides,
});

describe("model region variants", () => {
	it("collapses Bedrock regional siblings into one model entry", () => {
		const entries = collapseRegionalModelVariants([
			makeModel("anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6"),
			makeModel("us.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (US)"),
			makeModel("eu.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (EU)"),
			makeModel("global.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (Global)"),
			makeModel("deepseek-chat", "DeepSeek Chat", "deepseek"),
		]);

		const sonnetEntry = entries.find((entry) => entry.model.id === "anthropic.claude-sonnet-4-6");

		expect(entries).toHaveLength(2);
		expect(sonnetEntry?.model.name).toBe("Claude Sonnet 4.6");
		expect(sonnetEntry?.regionOptions.map((option) => option.label)).toEqual([
			"Default",
			"Global",
			"US",
			"EU",
		]);
	});

	it("uses a regional primary when no unqualified Bedrock model exists", () => {
		const entries = collapseRegionalModelVariants([
			makeModel("us.anthropic.claude-haiku-4-5", "Claude Haiku 4.5 (US)"),
			makeModel("eu.anthropic.claude-haiku-4-5", "Claude Haiku 4.5 (EU)"),
		]);

		expect(entries).toHaveLength(1);
		expect(entries[0].model.id).toBe("us.anthropic.claude-haiku-4-5");
		expect(entries[0].model.name).toBe("Claude Haiku 4.5");
		expect(entries[0].regionOptions.map((option) => option.label)).toEqual(["US", "EU"]);
	});

	it("matches selections against hidden regional siblings", () => {
		const [entry] = collapseRegionalModelVariants([
			makeModel("anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6"),
			makeModel("jp.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (JP)"),
		]);

		expect(isRegionalModelEntrySelected(entry, "jp.anthropic.claude-sonnet-4-6")).toBe(true);
		expect(getRegionalModelDisplayName(entry.regionOptions[1].model)).toBe("Claude Sonnet 4.6");
	});
});
