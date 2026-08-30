import { describe, expect, it } from "vitest";

import { getWorkDataContext, type WorkContextHotData } from "./WorkDataContext";

describe("getWorkDataContext", () => {
  it("reuses the context identity across hot module evaluations", () => {
    const hotData: WorkContextHotData = {};

    const firstContext = getWorkDataContext(hotData);
    const nextContext = getWorkDataContext(hotData);

    expect(nextContext).toBe(firstContext);
  });

  it("isolates server and production module evaluations", () => {
    expect(getWorkDataContext()).not.toBe(getWorkDataContext());
  });
});
