import {
  resolveAccountModelSelection,
  type AccountModelSelection,
} from "@ngriffin_uk/polychat-library-chat";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { POLY_TEAMMATE_ID } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConversationScopeProvider,
  useLocalConversationScope,
} from "../state/conversation-scope.js";
import { LoadingProvider } from "../state/LoadingContext.js";
import { useStreamingResponse } from "./useStreamingResponse.js";

vi.mock("./useModels.js", () => ({ useModels: () => ({ data: {} }) }));
vi.mock("./useWebLLMModels.js", () => ({ useWebLLMModels: () => ({}) }));
vi.mock("./useMessageOperations.js", () => ({
  useMessageOperations: () => ({
    addMessageToConversation: vi.fn(),
    insertMessageBeforeConversationMessage: vi.fn(),
    addAssistantMessage: async () => ({ id: "placeholder", role: "assistant", content: "" }),
    updateAssistantMessage: vi.fn(),
  }),
}));

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const reply: Message = { id: "reply", role: "assistant", content: "Done" };
const initialState = useChatStore.getState();
const initialStorage = useChatStore.persist.getOptions().storage;
let modelSelection: AccountModelSelection | undefined;

function Wrapper({ children }: { children: ReactNode }) {
  const scope = useLocalConversationScope("poly-home", undefined, {
    type: "teammate",
    id: POLY_TEAMMATE_ID,
  });

  return (
    <QueryClientProvider client={client}>
      <LoadingProvider>
        <ConversationScopeProvider scope={modelSelection ? { ...scope, modelSelection } : scope}>
          {children}
        </ConversationScopeProvider>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  useChatStore.persist.setOptions({
    storage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  });
  useChatStore.setState({
    model: "unrelated-openai-model",
    modelTier: "ultra",
    computeSite: "hosted",
    isAuthenticated: false,
    user: null,
  });
  modelSelection = undefined;
  vi.spyOn(apiService, "createResponse").mockResolvedValue(reply);
});

afterEach(() => {
  cleanup();
  client.clear();
  useChatStore.setState(initialState);
  useChatStore.persist.setOptions({ storage: initialStorage });
  vi.restoreAllMocks();
});

describe("scoped conversation model choices", () => {
  it("uses Poly's account model and follows changes while another chat stays selected", async () => {
    modelSelection = resolveAccountModelSelection({ default_model_id: "preferred-model" });
    const { result, rerender } = renderHook(() => useStreamingResponse(undefined), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.generateResponse(
        [{ id: "hello", role: "user", content: "Hello" }],
        "poly-home",
      );
    });

    expect(apiService.createResponse).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: "preferred-model", modelTier: undefined }),
    );

    modelSelection = resolveAccountModelSelection({ default_model_tier: "high" });
    rerender();

    await act(async () => {
      await result.current.generateResponse(
        [{ id: "again", role: "user", content: "Again" }],
        "poly-home",
      );
    });

    expect(apiService.createResponse).toHaveBeenLastCalledWith(
      expect.objectContaining({ model: undefined, modelTier: "high" }),
    );
    expect(useChatStore.getState().model).toBe("unrelated-openai-model");
  });

  it("lets a teammate resolve its configured model without inheriting another chat's model or tier", async () => {
    const { result } = renderHook(() => useStreamingResponse(undefined), { wrapper: Wrapper });

    await act(async () => {
      await result.current.generateResponse(
        [{ id: "hello", role: "user", content: "Hello" }],
        "poly-home",
      );
    });

    expect(apiService.createResponse).toHaveBeenCalledWith(
      expect.objectContaining({ model: undefined, modelTier: undefined }),
    );
  });

  it("keeps the main chat's selection when a scoped model is unavailable", async () => {
    modelSelection = resolveAccountModelSelection({ default_model_id: "missing-model" });
    vi.mocked(apiService.createResponse).mockRejectedValueOnce(
      Object.assign(new Error("Model unavailable"), { code: "model_not_found" }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useStreamingResponse(undefined), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.streamResponse(
          [{ id: "hello", role: "user", content: "Hello" }],
          "poly-home",
        ),
      ).rejects.toThrow("Model unavailable");
    });

    expect(useChatStore.getState().model).toBe("unrelated-openai-model");
  });
});
