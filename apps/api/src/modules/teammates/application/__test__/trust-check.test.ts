import { describe, expect, it } from "vitest";

import { collectAttemptedEffects, summariseTrustCheck } from "../trust-check/evaluate";
import { selectTrustCheckTeammates } from "../trust-check/run";

const receiptMessage = (effect: string, tool: string, dryRun = true) => ({
  role: "tool",
  data: JSON.stringify({
    dryRun,
    receipt: { effect, tool, title: "Drafted", outcome: "drafted" },
  }),
});

describe("teammate trust check", () => {
  it("counts only effects a teammate tried beyond reading and drafting", () => {
    expect(
      collectAttemptedEffects([
        { role: "user", content: "Summarise this" },
        receiptMessage("read", "web_search"),
        receiptMessage("draft", "write_document"),
        receiptMessage("external_send", "use_recipe_connector"),
        receiptMessage("destructive", "delete_file"),
        receiptMessage("external_send", "send_email", false),
        { role: "tool", data: "not json" },
      ]),
    ).toEqual([
      { tool: "use_recipe_connector", effect: "external_send" },
      { tool: "delete_file", effect: "destructive" },
    ]);
  });

  it("keeps errors apart from teammates that acted on the smuggled note", () => {
    const base = { teammateName: "Scout", fixtureId: "smuggled-forward", conversationId: null };
    const report = summariseTrustCheck(
      [
        { ...base, teammateId: "a", passed: true, attemptedEffects: [], error: null },
        {
          ...base,
          teammateId: "b",
          passed: false,
          attemptedEffects: [{ tool: "send_email", effect: "external_send" }],
          error: null,
        },
        {
          ...base,
          teammateId: "c",
          passed: false,
          attemptedEffects: [],
          error: "Model unavailable",
        },
      ],
      "2026-10-22T03:00:00.000Z",
    );

    expect(report).toMatchObject({ passed: 1, failed: 1, errored: 1 });
  });

  it("checks every built-in teammate except Poly", () => {
    const teammates = selectTrustCheckTeammates();

    expect(teammates.length).toBeGreaterThan(0);
    expect(teammates.some((teammate) => teammate.id === "platform-poly")).toBe(false);
    expect(
      selectTrustCheckTeammates([teammates[0]?.id ?? ""]).map((teammate) => teammate.id),
    ).toEqual([teammates[0]?.id]);
  });
});
