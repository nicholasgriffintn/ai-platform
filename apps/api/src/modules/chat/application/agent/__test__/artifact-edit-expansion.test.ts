import { describe, expect, it, vi } from "vitest";

import { expandTurnArtifactEdits } from "../artifact-edit-expansion";

const earlier = '<artifact identifier="plan" type="text/markdown">\nShip on Monday\n</artifact>';
const editReply =
  '<artifact identifier="plan" type="text/markdown" mode="edit">\n<<<<<<< FIND\nMonday\n=======\nFriday\n>>>>>>> REPLACE\n</artifact>';

describe("expandTurnArtifactEdits", () => {
  it("stores the full artifact in both the content and the text parts", async () => {
    const result = await expandTurnArtifactEdits({
      turn: {
        content: editReply,
        toolCalls: [],
        parts: [{ type: "text", text: editReply }],
      } as never,
      loadHistory: async () => [{ role: "assistant", content: earlier }] as never,
    });

    expect(result.changed).toBe(true);
    expect(result.turn.content).toContain("Ship on Friday");
    expect(result.turn.content).not.toContain('mode="edit"');
    expect(result.turn.parts?.[0]).toMatchObject({
      text: expect.stringContaining("Ship on Friday"),
    });
  });

  it("does not load history for replies without edits", async () => {
    const loadHistory = vi.fn();

    await expandTurnArtifactEdits({
      turn: { content: earlier, toolCalls: [] } as never,
      loadHistory,
    });

    expect(loadHistory).not.toHaveBeenCalled();
  });
});
