import { describe, expect, it } from "vitest";

import { isModelSelectableForAccount, runsOnDevice } from "./model-selection";

describe("device models", () => {
  it("treats a model that says nothing as running on the server", () => {
    expect(runsOnDevice({ runsOn: undefined })).toBe(false);
    expect(runsOnDevice({ runsOn: "server" })).toBe(false);
    expect(runsOnDevice({ runsOn: "device" })).toBe(true);
  });

  it("lets any account run a model on its own machine, plan or no plan", () => {
    expect(isModelSelectableForAccount({ runsOn: "device" }, false)).toBe(true);
    expect(isModelSelectableForAccount({ runsOn: "server" }, false)).toBe(false);
    expect(isModelSelectableForAccount({ runsOn: "server", isFree: true }, false)).toBe(true);
  });
});
