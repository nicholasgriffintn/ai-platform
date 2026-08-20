import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ChatSuggestion, ChatSuggestionList, ConversationSurface } from "./index";

afterEach(cleanup);

describe("ChatSuggestionList", () => {
  it("reports controlled suggestion and shuffle choices", () => {
    const suggestion: ChatSuggestion = {
      category: "engineering",
      id: "one",
      label: "Explain this project",
      prompt: "Explain this project to me",
      hint: "Switches to Council mode",
    };
    const onSelect = vi.fn();
    const onRefresh = vi.fn();

    render(
      <ChatSuggestionList
        suggestions={[suggestion]}
        showRefresh
        onRefresh={onRefresh}
        onSelect={onSelect}
      />,
    );
    const suggestionButton = screen.getByRole("button", { name: suggestion.label });
    const shuffleButton = screen.getByRole("button", { name: "Shuffle" });

    expect(suggestionButton.querySelector("svg")).not.toBeNull();
    expect(suggestionButton.getAttribute("title")).toBe(suggestion.hint);
    expect(shuffleButton.querySelector("svg")).not.toBeNull();

    fireEvent.click(suggestionButton);
    fireEvent.click(shuffleButton);

    expect(onSelect).toHaveBeenCalledWith(suggestion);
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("hides the shuffle control when the host supplies its own suggestions", () => {
    render(
      <ChatSuggestionList
        suggestions={[{ category: "engineering", id: "one", label: "Fix a bug" }]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Shuffle" })).toBeNull();
  });

  it("exposes its loading state instead of stale choices", () => {
    render(<ChatSuggestionList suggestions={[]} isLoading onSelect={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Loading suggestions" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ConversationSurface", () => {
  it("renders a complete controlled conversation and emits composer intents", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ConversationSurface
        controller={{
          messages: [{ id: "message-1", role: "assistant", content: "Hello" }],
          composer: { value: " Next question ", onChange, onSubmit },
        }}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Hello")).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith("Changed");
    expect(onSubmit).toHaveBeenCalledWith("Next question");
  });

  it("models an unavailable composer explicitly", () => {
    render(
      <ConversationSurface
        controller={{
          messages: [],
          composer: {
            value: "Hello",
            unavailableReason: "Sign in to send messages",
            onChange: vi.fn(),
            onSubmit: vi.fn(),
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Sign in to send messages")).toBeTruthy();
  });
});
