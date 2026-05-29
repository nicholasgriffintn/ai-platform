import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelConfig } from "~/types";
import { OpinionModelSelector } from "./OpinionModelSelector";

vi.mock("~/hooks/useModels", () => ({
	useModels: vi.fn(),
}));

vi.mock("~/hooks/useWebLLMModels", () => ({
	useWebLLMModels: vi.fn(),
}));

const apiModels: ModelConfig = {
	"current-model": {
		id: "current-model",
		matchingModel: "current-model",
		name: "Claude Current",
		provider: "anthropic",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"featured-alpha": {
		id: "featured-alpha",
		matchingModel: "featured-alpha",
		name: "Featured Alpha",
		provider: "openai",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"featured-beta": {
		id: "featured-beta",
		matchingModel: "featured-beta",
		name: "Featured Beta",
		provider: "google-ai-studio",
		isFeatured: true,
		modalities: { input: ["text"], output: ["text"] },
	},
	"deepseek-chat": {
		id: "deepseek-chat",
		matchingModel: "deepseek-chat",
		name: "DeepSeek Chat",
		provider: "deepseek",
		isFeatured: false,
		modalities: { input: ["text"], output: ["text"] },
	},
};

describe("OpinionModelSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useModels).mockReturnValue({
			data: apiModels,
			isLoading: false,
		} as ReturnType<typeof useModels>);
		vi.mocked(useWebLLMModels).mockReturnValue({});
		useChatStore.setState({
			chatMode: "remote",
			model: "current-model",
		});
	});

	it("defaults to a featured model other than the source model", () => {
		const onSubmit = vi.fn();

		render(
			<OpinionModelSelector onSubmit={onSubmit} onCancel={vi.fn()} sourceModelId="current-model" />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Ask for opinion" }));

		expect(onSubmit).toHaveBeenCalledWith({
			mode: "second-opinion",
			modelIds: ["featured-alpha"],
		});
	});

	it("allows selecting multiple models for consensus", () => {
		const onSubmit = vi.fn();

		render(
			<OpinionModelSelector onSubmit={onSubmit} onCancel={vi.fn()} sourceModelId="current-model" />,
		);

		fireEvent.click(screen.getByRole("button", { name: "Consensus" }));
		fireEvent.click(screen.getByRole("button", { name: "Ask for consensus" }));

		expect(onSubmit).toHaveBeenCalledWith({
			mode: "consensus",
			modelIds: ["featured-alpha", "featured-beta"],
		});
	});

	it("searches non-featured models", () => {
		render(<OpinionModelSelector onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.queryByText("DeepSeek Chat")).not.toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText("Search models"), {
			target: { value: "deep" },
		});

		expect(screen.getByText("DeepSeek Chat")).toBeInTheDocument();
	});
});
