import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "~/types";
import { ModelsList } from "./ModelsList";

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({
		trackFeatureUsage: vi.fn(),
	}),
}));

vi.mock("~/components/ModelIcon", () => ({
	ModelIcon: ({ modelName }: { modelName: string }) => <span>{modelName}</span>,
}));

afterEach(() => {
	vi.restoreAllMocks();
});

const makeModel = (
	id: string,
	name: string,
	provider: string,
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

describe("ModelsList", () => {
	it("opens the selected model provider and scrolls to the selected model", () => {
		const scrollIntoView = vi.fn();
		Object.defineProperty(Element.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		});

		render(
			<ModelsList
				models={[
					makeModel("claude-sonnet", "Claude Sonnet", "anthropic", { isFeatured: true }),
					makeModel("deepseek-chat", "DeepSeek Chat", "deepseek"),
					makeModel("deepseek-reasoner", "DeepSeek Reasoner", "deepseek"),
				]}
				featuredModelIds={{
					"claude-sonnet": makeModel("claude-sonnet", "Claude Sonnet", "anthropic", {
						isFeatured: true,
					}),
				}}
				isPro={true}
				onSelect={vi.fn()}
				selectedId="deepseek-reasoner"
			/>,
		);

		expect(screen.getByRole("heading", { name: "Deepseek" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Deepseek/i })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("option", { name: /DeepSeek Reasoner/i })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
	});

	it("shows active search results as provider sections", () => {
		render(
			<ModelsList
				models={[
					makeModel("kimi-k2", "Kimi K2", "deepinfra", { isFeatured: true }),
					makeModel("moonshot-kimi", "Moonshot Kimi K2.6", "moonshot"),
				]}
				featuredModelIds={{
					"kimi-k2": makeModel("kimi-k2", "Kimi K2", "deepinfra", { isFeatured: true }),
				}}
				isPro={true}
				onSelect={vi.fn()}
				isSearchActive={true}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /featured/i })).not.toBeInTheDocument();

		const deepinfraSection = screen.getByRole("heading", {
			name: "Deepinfra",
		}).parentElement?.parentElement;
		const moonshotSection = screen.getByRole("heading", {
			name: "Moonshot",
		}).parentElement?.parentElement;

		expect(deepinfraSection).not.toBeNull();
		expect(moonshotSection).not.toBeNull();
		expect(within(deepinfraSection!).getByRole("option", { name: /Kimi K2/i })).toBeInTheDocument();
		expect(
			within(moonshotSection!).getByRole("option", { name: /Moonshot Kimi K2.6/i }),
		).toBeInTheDocument();
	});

	it("opens deprecated models when the selected model is deprecated", () => {
		render(
			<ModelsList
				models={[
					makeModel("claude-sonnet", "Claude Sonnet", "anthropic", { isFeatured: true }),
					makeModel("deepseek-chat", "DeepSeek Chat", "deepseek"),
					makeModel("deepseek-legacy", "DeepSeek Legacy", "deepseek", { deprecated: true }),
				]}
				featuredModelIds={{
					"claude-sonnet": makeModel("claude-sonnet", "Claude Sonnet", "anthropic", {
						isFeatured: true,
					}),
				}}
				isPro={true}
				onSelect={vi.fn()}
				selectedId="deepseek-legacy"
			/>,
		);

		expect(screen.getByRole("heading", { name: "Deepseek" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Hide deprecated models \(1\)/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: /DeepSeek Legacy/i })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("does not show an empty-state message when deprecated models exist", () => {
		render(
			<ModelsList
				models={[makeModel("legacy-only", "Legacy Only", "provider", { deprecated: true })]}
				featuredModelIds={{}}
				isPro={true}
				onSelect={vi.fn()}
			/>,
		);

		expect(
			screen.getByRole("button", { name: /Show deprecated models \(1\)/i }),
		).toBeInTheDocument();
		expect(screen.queryByText("No models available in this category.")).not.toBeInTheDocument();
	});
});
