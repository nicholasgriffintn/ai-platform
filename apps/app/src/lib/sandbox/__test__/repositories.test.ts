import { describe, expect, it } from "vitest";

import {
	isGitHubRepoSlug,
	normaliseGitHubRepoInput,
	parseGitHubRepositoryList,
} from "../repositories";

describe("sandbox repository utilities", () => {
	it("normalises a GitHub URL to owner/repo slug", () => {
		expect(
			normaliseGitHubRepoInput("https://github.com/openai/codex.git"),
		).toBe("openai/codex");
	});

	it("returns trimmed input when URL host is not GitHub", () => {
		expect(normaliseGitHubRepoInput(" https://example.com/openai/codex ")).toBe(
			"https://example.com/openai/codex",
		);
	});

	it("parses and deduplicates repository lists", () => {
		expect(
			parseGitHubRepositoryList(
				"openai/codex, https://github.com/openai/codex\nopenai/chatgpt",
			),
		).toEqual(["openai/codex", "openai/chatgpt"]);
	});

	it("validates repository slugs", () => {
		expect(isGitHubRepoSlug("owner/repo")).toBe(true);
		expect(isGitHubRepoSlug("not-a-slug")).toBe(false);
	});
});
