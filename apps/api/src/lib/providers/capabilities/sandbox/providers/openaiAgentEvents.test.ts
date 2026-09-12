import { describe, expect, it } from "vitest";

import { OpenAIAgentEventTranslator } from "./openaiAgentEvents";

describe("OpenAI agent event translation", () => {
  it("captures durable identifiers and completed output for the root turn", () => {
    const translator = new OpenAIAgentEventTranslator("run-1");

    translator.handle({ type: "agent.session.created", session: { id: "session-1" } });
    translator.handle({
      type: "agent.session.turn.output_text.delta",
      item_id: "message-1",
      output_index: 0,
      content_index: 0,
      delta: "Done",
    });

    const events = translator.handle({
      type: "agent.session.turn.output_text.done",
      item_id: "message-1",
      output_index: 0,
      content_index: 0,
      text: "Done successfully",
    });

    translator.handle({
      type: "agent.session.turn.completed",
      turn: { id: "turn-1", subagent_id: null },
    });

    expect(translator).toMatchObject({
      sessionId: "session-1",
      turnId: "turn-1",
      terminalStatus: "completed",
    });
    expect(translator.outputText()).toBe("Done successfully");
    expect(events).toEqual([
      expect.objectContaining({ type: "agent_message", message: "Done successfully" }),
    ]);
  });

  it("does not end the run for a completed subagent turn", () => {
    const translator = new OpenAIAgentEventTranslator("run-1");

    translator.handle({
      type: "agent.session.turn.completed",
      turn: { id: "turn-child", subagent_id: "subagent-1" },
    });

    expect(translator.terminalStatus).toBeUndefined();
  });
});
