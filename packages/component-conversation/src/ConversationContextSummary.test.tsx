import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationContextSummaryButton } from "./ConversationContextSummary.js";

describe("ConversationContextSummaryButton", () => {
  it("combines context and trace details behind one summary control", async () => {
    render(
      <ConversationContextSummaryButton
        context={{
          protocolVersion: 1,
          runId: "run-1",
          conversationId: "conversation-1",
          attempt: 1,
          step: 2,
          model: "test-model",
          generatedAt: "2026-09-12T00:00:00.000Z",
          usage: { inputTokens: 4_000, contextWindow: 8_000, source: "reported" },
          messages: { included: 3, omitted: 0 },
          sources: [],
          skills: [],
          summary: null,
          omissions: [],
        }}
        entries={[
          {
            id: "user:1",
            type: "user_turn",
            label: "Build the combined conversation header",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "Context and trace summary" });

    expect(screen.queryByRole("button", { name: "View run context" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View conversation trace" })).toBeNull();

    fireEvent.click(button);

    expect(await screen.findByText("Context & trace")).toBeTruthy();
    expect(screen.getByText("50% context · 1 trace event")).toBeTruthy();
    expect(screen.getByText("Run context")).toBeTruthy();
    expect(screen.getByText("Trace")).toBeTruthy();
  });

  it("renders nothing when no summary evidence exists", () => {
    const { container } = render(<ConversationContextSummaryButton entries={[]} />);

    expect(container.childElementCount).toBe(0);
  });
});
