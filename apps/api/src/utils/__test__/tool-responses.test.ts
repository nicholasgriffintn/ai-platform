import { ResponseDisplayType } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { formatToolResponse } from "../tool-responses";

describe("goal tool presentation", () => {
  it("hides the goal tools' own results, since the thread already carries a goal marker", () => {
    for (const toolName of ["set_goal", "complete_goal"]) {
      expect(formatToolResponse(toolName, "Goal completed").data.responseType).toBe(
        ResponseDisplayType.HIDDEN,
      );
    }
  });

  it("leaves other tools visible", () => {
    expect(formatToolResponse("web_search", "results").data.responseType).not.toBe(
      ResponseDisplayType.HIDDEN,
    );
  });
});

describe("memory tool presentation", () => {
  it("keeps retrieved memory context out of the visible conversation", () => {
    expect(
      formatToolResponse("search_memories", "Private retrieved context").data.responseType,
    ).toBe(ResponseDisplayType.HIDDEN);
  });

  it("keeps memory storage confirmation visible", () => {
    expect(formatToolResponse("store_memory", "Memory stored").data.responseType).not.toBe(
      ResponseDisplayType.HIDDEN,
    );
  });
});
