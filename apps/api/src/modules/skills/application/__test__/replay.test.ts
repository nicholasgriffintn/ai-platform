import type { SkillReplayCase, SkillReplayReport } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { assertReplayAllowsPromotion, summariseReplay } from "../replay";

const replayCase = (verdict: SkillReplayCase["verdict"]): SkillReplayCase => ({
  runId: `run-${verdict}`,
  request: "Draft the weekly update",
  verdict,
  reason: "Compared both answers",
});

const report = (
  status: SkillReplayReport["status"],
  cases: SkillReplayCase[] = [],
): SkillReplayReport => ({
  revisionId: "revision-2",
  status,
  cases,
  startedAt: "2026-10-22T00:00:00.000Z",
  finishedAt: status === "running" ? null : "2026-10-22T00:01:00.000Z",
  error: null,
});

describe("skill replay", () => {
  it("regresses when any replayed request got worse, and has no verdict without history", () => {
    expect(summariseReplay([replayCase("better"), replayCase("same")])).toEqual({
      status: "passed",
    });
    expect(summariseReplay([replayCase("better"), replayCase("worse")])).toEqual({
      status: "regressed",
    });
    expect(summariseReplay([])).toEqual({ status: "no_history" });
  });

  it("blocks promotion while replaying or after a regression unless the owner accepts it", () => {
    const regressed = report("regressed", [replayCase("worse"), replayCase("same")]);

    expect(() => assertReplayAllowsPromotion(report("running"), false)).toThrow(
      "still being replayed",
    );
    expect(() => assertReplayAllowsPromotion(regressed, false)).toThrow(
      "made 1 of 2 recent requests worse",
    );
    expect(() => assertReplayAllowsPromotion(regressed, true)).not.toThrow();
    expect(() => assertReplayAllowsPromotion(report("failed"), false)).not.toThrow();
    expect(() => assertReplayAllowsPromotion(null, false)).not.toThrow();
  });
});
