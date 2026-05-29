import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { useChatStore } from "~/state/stores/chatStore";
import type { ModelConfig } from "~/types";
import { InlineModelSelector } from "./InlineModelSelector";

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
		isFeatured: false,
	},
	"featured-alpha": {
		id: "featured-alpha",
		matchingModel: "featured-alpha",
		name: "Featured Alpha",
		provider: "openai",
		isFeatured: true,
	},
	"featured-beta": {
		id: "featured-beta",
		matchingModel: "featured-beta",
		name: "Featured Beta",
		provider: "google-ai-studio",
		isFeatured: true,
	},
	"deepseek-chat": {
		id: "deepseek-chat",
		matchingModel: "deepseek-chat",
		name: "DeepSeek Chat",
		provider: "deepseek",
		isFeatured: false,
	},
};

const webLLMModels: ModelConfig = {
	"llama-local": {
		id: "llama-local",
		matchingModel: "llama-local",
		name: "Llama Local",
		provider: "web-llm",
		isFeatured: true,
	},
};

describe("InlineModelSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(useModels).mockReturnValue({
			data: apiModels,
			isLoading: false,
		} as ReturnType<typeof useModels>);
		vi.mocked(useWebLLMModels).mockReturnValue(webLLMModels);
		useChatStore.setState({
			chatMode: "remote",
			model: "current-model",
		});
	});

	it("shows current and featured remote models, with search for non-featured models", () => {
		render(<InlineModelSelector onModelSelect={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByText("Current Model")).toBeInTheDocument();
		expect(screen.getByText("Claude Current")).toBeInTheDocument();
		expect(screen.getByText("Featured Alpha")).toBeInTheDocument();
		expect(screen.getByText("Featured Beta")).toBeInTheDocument();
		expect(screen.queryByText("DeepSeek Chat")).not.toBeInTheDocument();
		expect(screen.queryByText("Llama Local")).not.toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText("Search other models"), {
			target: { value: "deep" },
		});

		expect(screen.getByText("DeepSeek Chat")).toBeInTheDocument();
		expect(screen.getByText("Featured Alpha")).toBeInTheDocument();
		expect(screen.queryByText("Llama Local")).not.toBeInTheDocument();
	});
});
