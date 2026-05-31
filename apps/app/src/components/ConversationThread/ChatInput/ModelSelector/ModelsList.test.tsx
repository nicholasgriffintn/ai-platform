import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelConfigItem } from "~/types";
import { ModelsList } from "./ModelsList";

vi.mock("~/hooks/use-track-event", () => ({
	useTrackEvent: () => ({
		trackFeatureUsage: vi.fn(),
	}),
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

	it("allows BYOK models for non-pro users", () => {
		const onSelect = vi.fn();
		render(
			<ModelsList
				models={[
					makeModel("claude-sonnet", "Claude Sonnet", "anthropic", {
						isFree: false,
						isByokEnabled: true,
					}),
				]}
				featuredModelIds={{}}
				isPro={false}
				onSelect={onSelect}
			/>,
		);

		fireEvent.click(screen.getByRole("option", { name: /Claude Sonnet/i }));

		expect(onSelect).toHaveBeenCalledWith("claude-sonnet");
		expect(screen.getByText("BYOK")).toBeInTheDocument();
	});

	it("collapses Bedrock region variants behind a region selector", () => {
		const onSelect = vi.fn();
		render(
			<ModelsList
				models={[
					makeModel("anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6", "bedrock"),
					makeModel("us.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (US)", "bedrock"),
					makeModel("eu.anthropic.claude-sonnet-4-6", "Claude Sonnet 4.6 (EU)", "bedrock"),
					makeModel("amazon.nova-lite-v1:0", "Nova Lite", "bedrock"),
				]}
				featuredModelIds={{}}
				isPro={true}
				onSelect={onSelect}
				selectedId="us.anthropic.claude-sonnet-4-6"
			/>,
		);

		expect(screen.getByText("2 models")).toBeInTheDocument();
		expect(screen.getAllByRole("option", { name: /Claude Sonnet 4.6/i })).toHaveLength(1);
		expect(screen.queryByRole("option", { name: /Claude Sonnet 4.6 \(US\)/i })).toBeNull();

		const regionSelect = screen.getByRole("combobox", {
			name: "Select region for Claude Sonnet 4.6",
		});
		expect(regionSelect).toHaveValue("us.anthropic.claude-sonnet-4-6");

		fireEvent.change(regionSelect, {
			target: { value: "eu.anthropic.claude-sonnet-4-6" },
		});

		expect(onSelect).toHaveBeenCalledWith("eu.anthropic.claude-sonnet-4-6");
	});
});
