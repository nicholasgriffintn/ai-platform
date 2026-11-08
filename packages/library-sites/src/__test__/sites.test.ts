import { describe, expect, it } from "vitest";

import { applySitePatch, createSitePatchStreamReader } from "../patch.js";

describe("site patch stream", () => {
  it("ignores prose, fences and malformed lines without losing later patches", () => {
    const reader = createSitePatchStreamReader();
    const patches = reader.push(
      'Here you go:\n```json\n{"op":"add","path":"/title","value":"A"}\nnot json\n{"op":"add","path":"/description"}\n{"op":"add","path":"/pages","value":{}}\n```\n',
    );

    expect(patches.map((patch) => patch.path)).toEqual(["/title", "/pages"]);
    expect(reader.skippedLines()).toBe(3);
  });

  it("refuses prototype pollution paths", () => {
    expect(() =>
      applySitePatch({}, { op: "add", path: "/__proto__/polluted", value: true }),
    ).toThrow();
  });
});
