import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { createStreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessageStats } from "./MessageStats";
import { StreamActivityIndicator } from "./StreamActivityIndicator";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function assistantMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    role: "assistant",
    content: "hello",
    ...overrides,
  };
}

describe("StreamActivityIndicator", () => {
  it("shows the loading label alongside live metrics", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:12Z"));

    const activity = {
      ...createStreamActivity(new Date("2026-01-01T00:00:00Z").getTime()),
      contentChars: 4000,
    };

    render(<StreamActivityIndicator label="Thinking it through..." activity={activity} />);

    expect(screen.getByText("Thinking it through...")).toBeDefined();
    expect(screen.getByText("12s · ~1.0k out")).toBeDefined();
  });

  it("renders just the label when no activity is tracked", () => {
    render(<StreamActivityIndicator label="Calling provider..." activity={null} />);

    expect(screen.getByText("Calling provider...")).toBeDefined();
    expect(screen.getByTestId("stream-activity").textContent).toBe("Calling provider...");
  });
});

describe("MessageStats", () => {
  it("summarises the finished response", () => {
    render(
      <MessageStats
        message={assistantMessage({ usage: { prompt_tokens: 900, completion_tokens: 500 } })}
        responseDurationMs={12_400}
        pricing={{ costPer1kInputTokens: 0.003, costPer1kOutputTokens: 0.015 }}
      />,
    );

    expect(screen.getByTestId("message-stats").textContent).toBe("12s · 1.4k tokens · ~$0.010");
  });

  it("renders nothing without stats to show", () => {
    const { container } = render(<MessageStats message={assistantMessage()} />);

    expect(container.firstChild).toBeNull();
  });
});
