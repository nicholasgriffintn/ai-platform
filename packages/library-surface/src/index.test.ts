import { describe, expect, it } from "vitest";

import type { SurfaceCapabilityUnavailableError } from "./index";
import { createUnavailableSurfaceAction } from "./index";

describe("surface controls", () => {
  it("fails closed when a host capability is unavailable", async () => {
    const action = createUnavailableSurfaceAction<string>("share", "not supported by this host");

    expect(action.availability).toEqual({
      status: "unavailable",
      reason: "not supported by this host",
    });
    await expect(action.run("content")).rejects.toEqual(
      expect.objectContaining<Partial<SurfaceCapabilityUnavailableError>>({
        name: "SurfaceCapabilityUnavailableError",
        capability: "share",
      }),
    );
  });
});
