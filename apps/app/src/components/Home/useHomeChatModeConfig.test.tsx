import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelConfig, ModelConfigItem } from "~/types";
import { useHomeChatModeConfig } from "./useHomeChatModeConfig";

const setSearchParams = vi.fn();
const setChatMode = vi.fn();
const setHomeChatMode = vi.fn();
const setModel = vi.fn();
const setSandboxModeSettings = vi.fn();
const setSelectedAgentId = vi.fn();
const setLiveProvider = vi.fn();
const stopLiveSession = vi.fn();
const flushLiveMessages = vi.fn();

let searchParams = new URLSearchParams("mode=live");
const models: ModelConfig = {
	"deepseek-chat": {
		id: "deepseek-chat",
		matchingModel: "deepseek-chat",
		name: "DeepSeek Chat",
		provider: "deepseek",
		modalities: { input: ["text"], output: ["text"] },
	},
	"voxtral-mini-transcribe-realtime": {
		id: "voxtral-mini-transcribe-realtime",
		matchingModel: "voxtral-mini-transcribe-realtime-latest",
		name: "Voxtral Mini Transcribe Realtime",
		provider: "mistral",
		modalities: { input: ["audio"], output: ["transcription"] },
		supportsRealtimeSession: true,
	},
};
const chatStoreState = {
	chatSettings: {},
	currentConversationId: undefined as string | undefined,
	homeChatMode: "live",
	model: "voxtral-mini-transcribe-realtime" as string | null,
	sandboxModeSettings: {},
};
const liveSessionState = {
	provider: "mistral",
};

vi.mock("react-router", () => ({
	useSearchParams: () => [searchParams, setSearchParams],
}));

vi.mock("~/hooks/useChat", () => ({
	useChat: () => ({ data: undefined }),
}));

vi.mock("~/hooks/useLiveConversationMessages", () => ({
	useLiveConversationMessages: () => ({
		flushLiveMessages,
		handleRealtimeEvent: vi.fn(),
		handleTranscript: vi.fn(),
	}),
}));

vi.mock("~/hooks/useModels", () => ({
	useModels: () => ({
		data: models,
	}),
}));

vi.mock("~/hooks/useRealtimeLiveSession", () => ({
	useRealtimeLiveSession: () => ({
		error: null,
		inputAudioLevel: 0,
		isMicrophoneEnabled: true,
		isVideoEnabled: false,
		lastEvent: "Ready",
		lastTranscript: null,
		outputAudioLevel: 0,
		provider: liveSessionState.provider,
		setMicrophoneEnabled: vi.fn(),
		setProvider: setLiveProvider,
		setVideoEnabled: vi.fn(),
		start: vi.fn(),
		status: "idle",
		stop: stopLiveSession,
	}),
}));

vi.mock("~/hooks/useSandbox", () => ({
	useSandboxConnections: () => ({ data: [] }),
	useSandboxRepositoryOptions: () => ({
		isLoading: false,
		repoOptions: [],
	}),
	useUpdateSandboxConnectionRepositories: () => ({
		isPending: false,
		mutate: vi.fn(),
	}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		...chatStoreState,
		setChatMode,
		setHomeChatMode,
		setModel,
		setSandboxModeSettings,
		setSelectedAgentId,
	}),
}));

describe("useHomeChatModeConfig", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		searchParams = new URLSearchParams("mode=live");
		chatStoreState.homeChatMode = "live";
		chatStoreState.model = "voxtral-mini-transcribe-realtime";
		liveSessionState.provider = "mistral";
	});

	it("offers chat and live models from live mode", () => {
		const { result } = renderHook(() => useHomeChatModeConfig());

		expect(result.current.activeModeId).toBe("live");
		expect(result.current.modeConfig.modelScope).toBe("chat-and-live");
		expect(result.current.modeConfig.onModelChange).toEqual(expect.any(Function));
	});

	it("switches to live mode when a realtime model is selected", () => {
		searchParams = new URLSearchParams();
		chatStoreState.homeChatMode = "chat";
		chatStoreState.model = "deepseek-chat";
		liveSessionState.provider = "openai";

		const { result } = renderHook(() => useHomeChatModeConfig());

		act(() => {
			result.current.modeConfig.onModelChange?.(
				"voxtral-mini-transcribe-realtime",
				models["voxtral-mini-transcribe-realtime"] as ModelConfigItem,
			);
		});

		const nextParams = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;

		expect(result.current.activeModeId).toBe("live");
		expect(setHomeChatMode).toHaveBeenCalledWith("live");
		expect(setLiveProvider).toHaveBeenCalledWith("mistral");
		expect(nextParams.get("mode")).toBe("live");
	});

	it("switches back to chat when a chat model is selected from live mode", () => {
		const { result } = renderHook(() => useHomeChatModeConfig());

		act(() => {
			result.current.modeConfig.onModelChange?.(
				"deepseek-chat",
				models["deepseek-chat"] as ModelConfigItem,
			);
		});

		const nextParams = setSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;

		expect(result.current.activeModeId).toBe("chat");
		expect(flushLiveMessages).toHaveBeenCalledTimes(1);
		expect(stopLiveSession).toHaveBeenCalledTimes(1);
		expect(setHomeChatMode).toHaveBeenCalledWith("chat");
		expect(nextParams.get("mode")).toBeNull();
	});
});
