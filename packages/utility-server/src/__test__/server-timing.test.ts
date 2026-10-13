import { describe, expect, it } from "vitest";

import {
  formatServerTimings,
  recordServerTiming,
  runWithServerTimings,
  timeServerPhase,
  type ServerTimings,
} from "../server-timing";

describe("server timings", () => {
  it("aggregates phases recorded within the request scope only", async () => {
    const timings: ServerTimings = new Map();

    recordServerTiming("db", 99);

    await runWithServerTimings(timings, async () => {
      recordServerTiming("db", 4);
      recordServerTiming("db", 6);
      await timeServerPhase("do", async () => undefined);
    });

    expect(timings.get("db")).toEqual({ duration: 10, count: 2 });
    expect(timings.get("do")?.count).toBe(1);
    expect(formatServerTimings(timings, 12)).toMatch(
      /^db;dur=10\.0;desc="2", do;dur=\d+\.\d;desc="1", total;dur=12\.0$/,
    );
  });
});
