import { apiService } from "@ngriffin_uk/polychat-library-client";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoPlayResponses } from "./useAutoPlayResponses.js";

const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  apiService: { generateSpeech: vi.fn(), updateConversation: vi.fn() },
}));
vi.mock("@ngriffin_uk/polychat-library-react", () => ({
  useConversationStorage: () => ({
    determineStorageMode: () => ({ retention: "transient" }),
    updateConversation: vi.fn(async () => undefined),
  }),
}));

const reply = { id: "m1", role: "assistant", content: "Hello there" } as any;

function play() {
  const view = renderHook((props) => useAutoPlayResponses(props), {
    initialProps: {
      conversationId: "c1",
      messages: [reply],
      isEnabled: true,
      isStreaming: true,
    },
  });

  view.rerender({ conversationId: "c1", messages: [reply], isEnabled: true, isStreaming: false });

  return view;
}

describe("useAutoPlayResponses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the spinner and says so when speech is not generated", async () => {
    vi.mocked(apiService.generateSpeech).mockResolvedValue({ status: "error" } as any);

    const { result } = play();

    expect(result.current.isGeneratingSpeech).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isGeneratingSpeech).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Failed to generate speech for this response");
  });

  it("still finishes when the messages refresh during generation", async () => {
    let finish: (value: unknown) => void = () => undefined;

    vi.mocked(apiService.generateSpeech).mockReturnValue(
      new Promise((resolve) => (finish = resolve)) as any,
    );

    const { result, rerender } = play();

    rerender({
      conversationId: "c1",
      messages: [{ ...reply }],
      isEnabled: true,
      isStreaming: false,
    });
    await act(async () => {
      finish({ status: "error" });
      await Promise.resolve();
    });

    expect(result.current.isGeneratingSpeech).toBe(false);
  });

  it("abandons generation when the conversation changes", async () => {
    let finish: (value: unknown) => void = () => undefined;

    vi.mocked(apiService.generateSpeech).mockReturnValue(
      new Promise((resolve) => (finish = resolve)) as any,
    );

    const { result, rerender } = play();

    rerender({ conversationId: "c2", messages: [], isEnabled: true, isStreaming: false });

    expect(result.current.isGeneratingSpeech).toBe(false);
    await act(async () => {
      finish({ status: "error" });
      await Promise.resolve();
    });

    expect(toastError).not.toHaveBeenCalled();
  });
});
